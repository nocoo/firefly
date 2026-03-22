/**
 * Database client for Firefly.
 *
 * Communicates with the lizhengme Cloudflare Worker which proxies
 * to D1 via native binding. All SQL goes through HTTP.
 *
 * Read queries → POST /api/query (write-guarded by Worker)
 * Write queries → POST /api/execute (single + batch)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DbQueryResult<T = Record<string, unknown>> {
  results: T[];
  meta: { changes: number; duration: number };
}

export interface DbMeta {
  changes: number;
  duration: number;
}

export interface DbBatchStatement {
  sql: string;
  params?: unknown[];
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface Db {
  /** Execute a read-only query and return typed results. */
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<DbQueryResult<T>>;

  /** Convenience: return the first row or null. */
  firstOrNull<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T | null>;

  /** Execute a write query (INSERT/UPDATE/DELETE) and return meta. */
  execute(sql: string, params?: unknown[]): Promise<DbMeta>;

  /** Execute multiple write queries in a batch (atomic via D1.batch). */
  batch(statements: DbBatchStatement[]): Promise<DbQueryResult[]>;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class DbError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "DbError";
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createDb(workerUrl: string, workerSecret: string): Db {
  if (!workerUrl) throw new Error("workerUrl is required");
  if (!workerSecret) throw new Error("workerSecret is required");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${workerSecret}`,
  };

  async function post<T>(path: string, body: unknown): Promise<T> {
    const url = `${workerUrl}${path}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new DbError(
        `Network error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new DbError(
        (data as { error?: string }).error ?? `HTTP ${res.status}`,
        res.status,
      );
    }

    return res.json() as Promise<T>;
  }

  const db: Db = {
    async query<T>(
      sql: string,
      params?: unknown[],
    ): Promise<DbQueryResult<T>> {
      return post<DbQueryResult<T>>("/api/query", {
        sql,
        params: params ?? [],
      });
    },

    async firstOrNull<T>(
      sql: string,
      params?: unknown[],
    ): Promise<T | null> {
      const result = await db.query<T>(sql, params);
      return result.results[0] ?? null;
    },

    async execute(sql: string, params?: unknown[]): Promise<DbMeta> {
      const result = await post<DbQueryResult>("/api/execute", {
        sql,
        params: params ?? [],
      });
      return result.meta;
    },

    async batch(statements: DbBatchStatement[]): Promise<DbQueryResult[]> {
      const result = await post<{ results: DbQueryResult[] }>(
        "/api/execute",
        { statements },
      );
      return result.results;
    },
  };

  return db;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _db: Db | undefined;

/** Get or create the database client singleton. */
export function getDb(): Db {
  if (!_db) {
    const url = process.env.WORKER_URL;
    const secret = process.env.WORKER_SECRET;

    if (!url || !secret) {
      throw new Error("WORKER_URL and WORKER_SECRET are required");
    }

    _db = createDb(url, secret);
  }
  return _db;
}

/** Reset singleton (for testing). */
export function resetDb(): void {
  _db = undefined;
}
