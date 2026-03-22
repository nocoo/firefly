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
});

// ---------------------------------------------------------------------------
// query()
// ---------------------------------------------------------------------------

describe("db.query", () => {
  let db: Db;
  const url = "https://lizhengme.worker.hexly.ai";
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
    expect(reqUrl).toBe(`${url}/api/query`);
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

  it("throws DbError on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(db.query("SELECT 1")).rejects.toThrow(DbError);
    await expect(db.query("SELECT 1")).rejects.toThrow("Network error: ECONNREFUSED");
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
    expect(reqUrl).toBe("https://w.test/api/execute");
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
