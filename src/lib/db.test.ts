import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createDb,
  getDb,
  resetDb,
  DbError,
  _resetLocalQueuesForTest,
  _internalForTest,
  type Db,
  type DbQueryResult,
} from "./db";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(
  status: number,
  body: unknown,
): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

// ---------------------------------------------------------------------------
// createDb()
// ---------------------------------------------------------------------------

describe("createDb", () => {
  it("throws if workerUrl is empty", () => {
    expect(() => createDb("", "secret")).toThrow("workerUrl is required");
  });

  it("throws if workerSecret is empty", () => {
    expect(() => createDb("https://w.test", "")).toThrow(
      "workerSecret is required",
    );
  });

  it("does NOT set Connection: close on any URL — keep-alive stays on (STU-2495)", async () => {
    // The initial STU-2495 mitigation (d7d328c) added `Connection: close`
    // for localhost, hoping to defeat a suspected stale-socket flake. The
    // subsequent CI evidence in run 30901699318 showed every request
    // returning 200 server-side with the client still throwing `fetch
    // failed`, which does not implicate stale sockets; forcing a fresh
    // TCP handshake per request only worsens accept-backlog pressure.
    // Keep-alive is now retained on all URLs; a bounded queue caps burst.
    const fetchMock = mockFetch(200, {
      results: [],
      meta: { changes: 0, duration: 0 },
    });
    vi.stubGlobal("fetch", fetchMock);

    const local = createDb("http://localhost:8787", "s");
    await local.query("SELECT 1");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(
      (init.headers as Record<string, string>).Connection,
    ).toBeUndefined();

    vi.restoreAllMocks();
  });

  it("does NOT set Connection: close on remote URLs (preserve keep-alive)", async () => {
    const fetchMock = mockFetch(200, {
      results: [],
      meta: { changes: 0, duration: 0 },
    });
    vi.stubGlobal("fetch", fetchMock);

    const remote = createDb("https://firefly.worker.dev", "s");
    await remote.query("SELECT 1");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(
      (init.headers as Record<string, string>).Connection,
    ).toBeUndefined();

    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// query()
// ---------------------------------------------------------------------------

describe("db.query", () => {
  let db: Db;
  // Hardcode a remote URL: STU-2495 splits the retry budget by URL shape,
  // so `process.env.WORKER_URL` (which may be http://localhost:… when the
  // E2E runner is active) would flip the whole describe onto the local
  // 5-attempt budget and break the assertions below. Localhost budget has
  // its own describe block further down.
  const url = "https://firefly.worker.dev";
  const secret = "test_secret";

  beforeEach(() => {
    db = createDb(url, secret);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST to /api/query with sql and params", async () => {
    const mockResult: DbQueryResult = {
      results: [{ id: "1", name: "test" }],
      meta: { changes: 0, duration: 1 },
    };
    const fetchMock = mockFetch(200, mockResult);
    vi.stubGlobal("fetch", fetchMock);

    const result = await db.query("SELECT * FROM users WHERE id = ?", ["1"]);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [reqUrl, reqInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(reqUrl).toBe(`${url}/api/v1/query`);
    expect(reqInit.method).toBe("POST");
    expect(reqInit.headers).toMatchObject({
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    });
    expect(JSON.parse(reqInit.body as string)).toEqual({
      sql: "SELECT * FROM users WHERE id = ?",
      params: ["1"],
    });
    expect(result).toEqual(mockResult);
  });

  it("defaults params to empty array", async () => {
    const fetchMock = mockFetch(200, { results: [], meta: { changes: 0, duration: 0 } });
    vi.stubGlobal("fetch", fetchMock);

    await db.query("SELECT 1");

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    expect(body.params).toEqual([]);
  });

  it("throws DbError on HTTP error with error message", async () => {
    const fetchMock = mockFetch(403, { error: "Write queries not allowed" });
    vi.stubGlobal("fetch", fetchMock);

    await expect(db.query("DELETE FROM users")).rejects.toThrow(DbError);
    await expect(db.query("DELETE FROM users")).rejects.toThrow(
      "Write queries not allowed",
    );
  });

  it("throws DbError on HTTP error without error field", async () => {
    const fetchMock = mockFetch(500, {});
    vi.stubGlobal("fetch", fetchMock);

    await expect(db.query("SELECT 1")).rejects.toThrow("HTTP 500");
  });

  it("throws DbError on network error after exhausting retries", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(db.query("SELECT 1")).rejects.toThrow(DbError);
    await expect(db.query("SELECT 1")).rejects.toThrow("Network error: ECONNREFUSED");
  });

  it("stringifies non-Error fetch rejections in the Network error message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("raw string"));

    await expect(db.query("SELECT 1")).rejects.toThrow(
      "Network error: raw string",
    );
  });

  it("retries transient fetch failures on query() and returns success (STU-2495)", async () => {
    const mockResult: DbQueryResult = {
      results: [{ id: "1" }],
      meta: { changes: 0, duration: 1 },
    };
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResult),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await db.query("SELECT 1");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual(mockResult);
  });

  it("gives up after 3 total attempts on repeated fetch failures (remote budget)", async () => {
    // db here targets a remote URL (https://firefly.worker.dev); STU-2495 P1
    // requires the wider 5-attempt tail to stay scoped to localhost.
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(db.query("SELECT 1")).rejects.toThrow(
      "Network error: fetch failed",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("preserves the underlying fetch error via DbError.cause", async () => {
    const original = new TypeError("fetch failed");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(original));

    try {
      await db.query("PRAGMA table_info(posts)");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(DbError);
      expect((err as DbError).cause).toBe(original);
    }
  });

  it("does not retry on HTTP error responses (returned unchanged)", async () => {
    const fetchMock = mockFetch(500, { error: "boom" });
    vi.stubGlobal("fetch", fetchMock);

    await expect(db.query("SELECT 1")).rejects.toThrow("boom");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry HTTP 500 whose body starts with 'Network error:' (STU-2495 P2)", async () => {
    // Distinguish real HTTP 500 responses from client-side fetch throws even
    // when the server body happens to prefix the message. Retry gate must
    // use DbError.kind ("http" vs "network"), not string prefix.
    const fetchMock = mockFetch(500, {
      error: "Network error: fetch failed downstream",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(db.query("SELECT 1")).rejects.toThrow(
      "Network error: fetch failed downstream",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry CTE/WITH-prefixed SQL — semantics not proven read-only (STU-2495 P1)", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      db.query(
        "WITH c AS (SELECT 1) UPDATE posts SET view_count = view_count + 1",
      ),
    ).rejects.toThrow("Network error: fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry PRAGMA-prefixed SQL", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(db.query("PRAGMA foreign_keys")).rejects.toThrow(
      "Network error: fetch failed",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("kind='network' when fetch throws; status is undefined", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    try {
      await db.query("PRAGMA table_info(posts)");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(DbError);
      expect((err as DbError).kind).toBe("network");
      expect((err as DbError).status).toBeUndefined();
    }
  });

  it("kind='http' when server returns 5xx; status is set", async () => {
    vi.stubGlobal("fetch", mockFetch(503, { error: "unavailable" }));
    try {
      await db.query("SELECT 1");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(DbError);
      expect((err as DbError).kind).toBe("http");
      expect((err as DbError).status).toBe(503);
    }
  });

  it("throws DbError when json() fails on error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error("bad json")),
      }),
    );

    await expect(db.query("SELECT 1")).rejects.toThrow("HTTP 502");
  });
});

// ---------------------------------------------------------------------------
// db.query — localhost retry budget (STU-2495 P1)
// ---------------------------------------------------------------------------

describe("db.query localhost retry budget", () => {
  let db: Db;

  beforeEach(() => {
    db = createDb("http://localhost:8787", "s");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries up to 5 attempts on repeated fetch failures (local budget)", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(db.query("SELECT 1")).rejects.toThrow(
      "Network error: fetch failed",
    );
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("still does NOT retry CTE-prefixed SQL on localhost", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      db.query(
        "WITH c AS (SELECT 1) UPDATE posts SET view_count = view_count + 1",
      ),
    ).rejects.toThrow("Network error: fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// db — bounded concurrency queue (STU-2495)
// ---------------------------------------------------------------------------

describe("db bounded concurrency (localhost)", () => {
  beforeEach(() => {
    _resetLocalQueuesForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _resetLocalQueuesForTest();
  });

  function makeGatedFetch(): {
    fetchMock: ReturnType<typeof vi.fn>;
    resolveOne: () => boolean;
    inFlight: () => number;
    peak: () => number;
    totalStarted: () => number;
  } {
    let inFlight = 0;
    let peak = 0;
    let started = 0;
    const pending: Array<() => void> = [];
    // Return a fake Response-shape object with sync json() so the
    // microtask chain from resolveOne() → postOnce's return is small
    // and predictable (real Response.json() takes many microtasks and
    // hides the barging race).
    function makeFakeResponse(): Response {
      return {
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            results: [],
            meta: { changes: 0, duration: 0 },
          }),
      } as unknown as Response;
    }
    const fetchMock = vi.fn(() => {
      inFlight++;
      started++;
      peak = Math.max(peak, inFlight);
      return new Promise<Response>((resolve) => {
        pending.push(() => {
          inFlight--;
          resolve(makeFakeResponse());
        });
      });
    });
    return {
      fetchMock,
      resolveOne: () => {
        const next = pending.shift();
        if (!next) return false;
        next();
        return true;
      },
      inFlight: () => inFlight,
      peak: () => peak,
      totalStarted: () => started,
    };
  }

  async function flush(): Promise<void> {
    // Give microtasks + queued waiters + Response.json() decoding a
    // chance to advance. Response.json() involves a real async decode
    // that takes several microtasks.
    for (let i = 0; i < 20; i++) await Promise.resolve();
  }

  it("caps concurrent fetches at 4 on localhost", async () => {
    const g = makeGatedFetch();
    vi.stubGlobal("fetch", g.fetchMock);
    const db = createDb("http://localhost:8787", "s");

    const promises = Array.from({ length: 10 }, () => db.query("SELECT 1"));
    await flush();

    expect(g.inFlight()).toBe(4);
    expect(g.totalStarted()).toBe(4);

    // Drain: resolve one at a time and let the queue enqueue the next.
    while (g.totalStarted() < 10 || g.inFlight() > 0) {
      const drained = g.resolveOne();
      if (!drained) break;
      await flush();
    }
    await Promise.all(promises);

    expect(g.totalStarted()).toBe(10);
    expect(g.peak()).toBeLessThanOrEqual(4);
  });

  it("does NOT cap concurrency on remote URLs", async () => {
    const g = makeGatedFetch();
    vi.stubGlobal("fetch", g.fetchMock);
    const db = createDb("https://firefly.worker.dev", "s");

    const promises = Array.from({ length: 10 }, () => db.query("SELECT 1"));
    await flush();

    expect(g.inFlight()).toBe(10);
    while (g.resolveOne()) {
      // drain all
    }
    await Promise.all(promises);
  });

  it("preserves FIFO order of queued requests on localhost", async () => {
    const g = makeGatedFetch();
    vi.stubGlobal("fetch", g.fetchMock);
    const db = createDb("http://localhost:8787", "s");

    const order: number[] = [];
    const promises = Array.from({ length: 8 }, (_, i) =>
      db.query(`SELECT ${i}`).then(() => order.push(i)),
    );
    await flush();

    // Drain in FIFO. Each resolve lets a queued waiter start the next
    // fetch, which must be the next-in-order caller.
    while (g.resolveOne()) {
      await flush();
    }
    await Promise.all(promises);

    expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("release hands the permit directly to a queued waiter (no barging) (STU-2495 R2)", async () => {
    // Drive the queue directly at its release boundary so the barging
    // race is deterministic. Going through fn's promise chain hides the
    // window because fetch → Response.json() adds many microtask hops.
    //
    // Scenario: 4 active + 1 queued waiter. When one active finishes
    // and finally→release() runs, the buggy release does
    //   active--                            // 4 → 3
    //   const next = waiters.shift(); next()
    // If a late caller enters run() AFTER active-- but BEFORE the
    // waiter's `active++` continuation runs, late sees active=3 < max
    // and grabs a permit. Then the waiter continuation increments
    // active again → peak = 5.
    //
    // Under fixed direct-handoff release, `active` is NEVER decremented
    // while a waiter is queued; the released permit sits at `active`
    // until the waiter consumes it. Late sees active=max, queues.
    const { FdQueue, LOCAL_MAX_CONCURRENCY } = _internalForTest;
    const q = new FdQueue(LOCAL_MAX_CONCURRENCY);
    expect(LOCAL_MAX_CONCURRENCY).toBe(4);

    let inFlight = 0;
    let peak = 0;
    const releases: Array<() => void> = [];
    const startOrder: number[] = [];
    let nextId = 0;
    const runOne = () => {
      const id = nextId++;
      return q.run(async () => {
        inFlight++;
        startOrder.push(id);
        peak = Math.max(peak, inFlight);
        await new Promise<void>((resolve) => releases.push(resolve));
        inFlight--;
      });
    };

    // 4 acquire + 1 queued waiter (id 4).
    const early = Array.from({ length: 5 }, () => runOne());
    for (let i = 0; i < 4; i++) await Promise.resolve();
    expect(inFlight).toBe(4);
    expect(startOrder).toEqual([0, 1, 2, 3]);

    // Now cause id 0 to finish AND schedule a late caller to enter
    // run() at the very next microtask boundary — i.e. before the
    // waiter's continuation gets scheduled. We synchronously resolve
    // id 0's release Promise; id 0's fn continuation is queued. Then
    // in a queueMicrotask that runs BEFORE id 0's finally chain, we
    // enqueue late. This mimics an unrelated code path calling
    // db.query() mid-tick, which is exactly the SSR-under-load pattern.
    releases[0]();
    let late: Promise<void> | undefined;
    queueMicrotask(() => {
      queueMicrotask(() => {
        late = runOne();
      });
    });

    // Let everything settle over generous microtask ticks.
    for (let i = 0; i < 40; i++) await Promise.resolve();

    // The invariant that must hold under any interleaving: peak never
    // exceeds 4. This is what breaks with buggy release; it stays 4
    // with direct handoff.
    expect(peak).toBeLessThanOrEqual(4);

    // The waiter (id 4) must have started; late may or may not have
    // started depending on interleaving, but either way peak is bounded.
    expect(startOrder).toContain(4);

    // Drain everything.
    while (releases.length > 0) {
      const r = releases.shift();
      if (r) r();
      for (let i = 0; i < 4; i++) await Promise.resolve();
    }
    await Promise.all([...early, ...(late ? [late] : [])]);
    expect(peak).toBeLessThanOrEqual(4);
  });

  it("shares a single queue across multiple createDb() clients pointed at the same localhost origin (STU-2495 R2)", async () => {
    // getDb() singleton, tracking singleton, and per-request createDb()
    // in proxy.ts all target the same wrangler-dev. They must share one
    // queue so the combined budget stays at 4, not 4 × N.
    const g = makeGatedFetch();
    vi.stubGlobal("fetch", g.fetchMock);
    const a = createDb("http://localhost:8787", "s");
    const b = createDb("http://localhost:8787", "s");

    // 4 from each — 8 total — must serialize through one queue.
    const promises = [
      ...Array.from({ length: 4 }, () => a.query("SELECT A")),
      ...Array.from({ length: 4 }, () => b.query("SELECT B")),
    ];
    await flush();

    expect(g.inFlight()).toBe(4);
    expect(g.peak()).toBeLessThanOrEqual(4);

    while (g.resolveOne()) await flush();
    await Promise.all(promises);
    expect(g.totalStarted()).toBe(8);
    expect(g.peak()).toBeLessThanOrEqual(4);
  });

  it("does NOT share a queue between localhost and 127.0.0.1 — each origin gets its own", async () => {
    // Registry key is the URL origin, so http://localhost:8787 and
    // http://127.0.0.1:8787 map to different queues even though they
    // resolve to the same host. That's fine — the queue is a defensive
    // burst suppressor, not a global lock; callers who need one shared
    // budget can pick one canonical form. This test locks the current
    // behaviour so a future rewrite that changes it does so on purpose.
    const g = makeGatedFetch();
    vi.stubGlobal("fetch", g.fetchMock);
    const a = createDb("http://localhost:8787", "s");
    const b = createDb("http://127.0.0.1:8787", "s");

    const promises = [
      ...Array.from({ length: 4 }, () => a.query("SELECT A")),
      ...Array.from({ length: 4 }, () => b.query("SELECT B")),
    ];
    await flush();
    // Two distinct queues → 8 in flight simultaneously.
    expect(g.inFlight()).toBe(8);

    while (g.resolveOne()) await flush();
    await Promise.all(promises);
  });
});

// ---------------------------------------------------------------------------
// firstOrNull()
// ---------------------------------------------------------------------------

describe("db.firstOrNull", () => {
  let db: Db;

  beforeEach(() => {
    db = createDb("https://w.test", "secret");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the first result row", async () => {
    const row = { id: "1", name: "nocoo" };
    vi.stubGlobal(
      "fetch",
      mockFetch(200, { results: [row, { id: "2" }], meta: { changes: 0, duration: 0 } }),
    );

    const result = await db.firstOrNull("SELECT * FROM users");
    expect(result).toEqual(row);
  });

  it("returns null when no results", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(200, { results: [], meta: { changes: 0, duration: 0 } }),
    );

    const result = await db.firstOrNull("SELECT * FROM users WHERE id = ?", ["999"]);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// execute()
// ---------------------------------------------------------------------------

describe("db.execute", () => {
  let db: Db;

  beforeEach(() => {
    db = createDb("https://w.test", "secret");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST to /api/execute and returns meta", async () => {
    const fetchMock = mockFetch(200, {
      results: [],
      meta: { changes: 1, duration: 5 },
    });
    vi.stubGlobal("fetch", fetchMock);

    const meta = await db.execute("INSERT INTO users (id, email, name) VALUES (?, ?, ?)", [
      "01",
      "test@test.com",
      "Test",
    ]);

    const [reqUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(reqUrl).toBe("https://w.test/api/v1/execute");
    expect(meta).toEqual({ changes: 1, duration: 5 });
  });

  it("defaults params to empty array", async () => {
    const fetchMock = mockFetch(200, {
      results: [],
      meta: { changes: 0, duration: 0 },
    });
    vi.stubGlobal("fetch", fetchMock);

    await db.execute("DELETE FROM temp");

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    expect(body.params).toEqual([]);
  });

  it("does NOT retry on network error — writes are non-idempotent (STU-2495)", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      db.execute("UPDATE posts SET view_count = view_count + 1 WHERE id = ?", [
        "p1",
      ]),
    ).rejects.toThrow("Network error: fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// batch()
// ---------------------------------------------------------------------------

describe("db.batch", () => {
  let db: Db;

  beforeEach(() => {
    db = createDb("https://w.test", "secret");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends statements array to /api/execute", async () => {
    const batchResults = {
      results: [
        { results: [], meta: { changes: 1, duration: 2 } },
        { results: [], meta: { changes: 1, duration: 3 } },
      ],
    };
    const fetchMock = mockFetch(200, batchResults);
    vi.stubGlobal("fetch", fetchMock);

    const results = await db.batch([
      { sql: "INSERT INTO tags (id, name, slug) VALUES (?, ?, ?)", params: ["1", "AI", "ai"] },
      { sql: "INSERT INTO tags (id, name, slug) VALUES (?, ?, ?)", params: ["2", "GPT", "gpt"] },
    ]);

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    expect(body.statements).toHaveLength(2);
    expect(results).toHaveLength(2);
    expect(results[0].meta.changes).toBe(1);
  });

  it("does NOT retry on network error — batches are non-idempotent (STU-2495)", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      db.batch([{ sql: "INSERT INTO tags (id) VALUES (?)", params: ["1"] }]),
    ).rejects.toThrow("Network error: fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// call()
// ---------------------------------------------------------------------------

describe("db.call", () => {
  const url = "https://w.test";
  const secret = "s";
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts to the given path with the supplied body and returns parsed JSON", async () => {
    const fetchMock = mockFetch(200, { ok: true, value: 42 });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const db = createDb(url, secret);
    const result = await db.call<{ ok: boolean; value: number }>(
      "/api/v1/custom",
      { foo: "bar" },
    );
    expect(result).toEqual({ ok: true, value: 42 });

    const [reqUrl, reqInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(reqUrl).toBe(`${url}/api/v1/custom`);
    expect(JSON.parse(reqInit.body as string)).toEqual({ foo: "bar" });
  });

  it("throws DbError on non-OK response", async () => {
    const fetchMock = mockFetch(500, { error: "boom" });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const db = createDb(url, secret);
    await expect(db.call("/api/v1/custom", {})).rejects.toBeInstanceOf(
      DbError,
    );
  });

  it("does NOT retry on network error — call() semantics unknown (STU-2495)", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError("fetch failed"));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const db = createDb(url, secret);
    await expect(db.call("/api/v1/custom", {})).rejects.toThrow(
      "Network error: fetch failed",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getDb() / resetDb() singleton
// ---------------------------------------------------------------------------

describe("getDb / resetDb", () => {
  afterEach(() => {
    resetDb();
    vi.unstubAllEnvs();
  });

  it("throws if WORKER_URL is not set", () => {
    vi.stubEnv("WORKER_URL", "");
    vi.stubEnv("WORKER_SECRET", "s");
    expect(() => getDb()).toThrow("WORKER_URL and WORKER_SECRET are required");
  });

  it("throws if WORKER_SECRET is not set", () => {
    vi.stubEnv("WORKER_URL", "https://w.test");
    vi.stubEnv("WORKER_SECRET", "");
    expect(() => getDb()).toThrow("WORKER_URL and WORKER_SECRET are required");
  });

  it("returns singleton and resets", () => {
    vi.stubEnv("WORKER_URL", "https://w.test");
    vi.stubEnv("WORKER_SECRET", "s");

    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);

    resetDb();
    const db3 = getDb();
    expect(db3).not.toBe(db1);
  });
});
