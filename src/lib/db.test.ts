import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createDb,
  getDb,
  resetDb,
  DbError,
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

  it("sets Connection: close on localhost URLs (STU-2495)", async () => {
    const fetchMock = mockFetch(200, {
      results: [],
      meta: { changes: 0, duration: 0 },
    });
    vi.stubGlobal("fetch", fetchMock);

    const local = createDb("http://localhost:8787", "s");
    await local.query("SELECT 1");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Connection).toBe("close");

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
