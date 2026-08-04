/**
 * Database client for Firefly.
 *
 * Communicates with the firefly Cloudflare Worker which proxies
 * to D1 via native binding. All SQL goes through HTTP.
 *
 * Read queries → POST /api/v1/query (write-guarded by Worker)
 * Write queries → POST /api/v1/execute (single + batch)
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

  /** Call a custom Worker endpoint (non-SQL). Reuses Worker URL and auth. */
  call<T = unknown>(path: string, body: unknown): Promise<T>;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export type DbErrorKind = "network" | "http";

export class DbError extends Error {
  public readonly kind: DbErrorKind;

  constructor(
    message: string,
    /** HTTP status when kind === "http"; undefined when kind === "network". */
    public readonly status?: number,
    kind?: DbErrorKind,
    /** Underlying cause (e.g. the TypeError from fetch(), which carries
     *  undici-specific codes such as UND_ERR_SOCKET on `.cause.code`). */
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "DbError";
    this.kind = kind ?? (status === undefined ? "network" : "http");
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

// Only /api/v1/query calls with a plain SELECT-prefix are retried. WITH/CTE
// and PRAGMA cannot be proven read-only from SQL text alone — a CTE like
// `WITH c AS (...) UPDATE posts SET view_count = view_count + 1` is legal in
// SQLite and would slip past the Worker's WRITE_RE. We retry only SQL whose
// first keyword is SELECT to keep at-most-once for anything ambiguous.
// Writes (`execute`, `batch`, `call`) never retry — see the reviewer's P1
// on 22dc220 in STU-2495.
//
// Retry budget is per-destination:
//   - localhost wrangler-dev: 5 attempts / 100+300+1000+3000ms tail.
//     The observed failure mode is an unconfirmed channel disruption
//     between Next.js and the local worker under high concurrency; only
//     a multi-second tail recovers.
//   - remote (Cloudflare): 3 attempts / 100+300ms tail. Same short budget
//     the codebase used before commit d7d328c widened it. Any wider policy
//     for prod needs its own SLO / failure evidence, not a spillover from
//     a local-E2E flake.
const LOCAL_RETRY_DELAYS_MS = [100, 300, 1000, 3000] as const;
const REMOTE_RETRY_DELAYS_MS = [100, 300] as const;
const RETRYABLE_SELECT_RE = /^\s*SELECT\b/i;
const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(?::|\/|$)/i;

const isTestEnv = () =>
  typeof process !== "undefined" &&
  (process.env.NODE_ENV === "test" || process.env.VITEST === "true");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createDb(workerUrl: string, workerSecret: string): Db {
  if (!workerUrl) throw new Error("workerUrl is required");
  if (!workerSecret) throw new Error("workerSecret is required");

  // In E2E (`localhost` wrangler-dev) under Playwright fan-out the client
  // fetch throws `Network error: fetch failed` in bursts while the worker
  // log shows every request returning 200 OK — an unconfirmed channel
  // disruption on the Next.js side of the localhost pipe (STU-2495 run
  // 30896621829). We do not have evidence identifying the specific undici
  // layer (see DbError.cause on the actual failure to inspect), so this is
  // a defensive mitigation, not a root-cause fix. `Connection: close` and
  // the wider retry tail are both scoped to localhost so production is
  // unchanged.
  const isLocal = LOCALHOST_RE.test(workerUrl);
  const retryDelays = isLocal ? LOCAL_RETRY_DELAYS_MS : REMOTE_RETRY_DELAYS_MS;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${workerSecret}`,
  };
  if (isLocal) headers.Connection = "close";

  async function postOnce<T>(path: string, body: unknown): Promise<T> {
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
        undefined,
        "network",
        { cause: err },
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

  async function postQueryWithRetry<T>(
    sql: string,
    payload: { sql: string; params: unknown[] },
  ): Promise<T> {
    const retryable = RETRYABLE_SELECT_RE.test(sql);
    if (!retryable) return postOnce<T>("/api/v1/query", payload);

    const attempts = retryDelays.length + 1;
    let lastErr: DbError | undefined;
    for (let i = 0; i < attempts; i++) {
      try {
        return await postOnce<T>("/api/v1/query", payload);
      } catch (err) {
        // Retry only on kind === "network"; HTTP responses (including 5xx
        // whose body happens to start with "Network error:") pass through.
        if (
          !(err instanceof DbError) ||
          err.kind !== "network" ||
          i === attempts - 1
        ) {
          throw err;
        }
        lastErr = err;
        if (!isTestEnv()) {
          console.warn(
            `[db] /api/v1/query attempt ${i + 1}/${attempts} failed: ${err.message} — retrying`,
          );
        }
        await sleep(isTestEnv() ? 0 : (retryDelays[i] ?? 0));
      }
    }
    // Unreachable — the final attempt either returns or throws above.
    throw lastErr ?? new DbError("Network error: retry loop exhausted");
  }

  const db: Db = {
    async query<T>(
      sql: string,
      params?: unknown[],
    ): Promise<DbQueryResult<T>> {
      return postQueryWithRetry<DbQueryResult<T>>(sql, {
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
      const result = await postOnce<DbQueryResult>("/api/v1/execute", {
        sql,
        params: params ?? [],
      });
      return result.meta;
    },

    async batch(statements: DbBatchStatement[]): Promise<DbQueryResult[]> {
      const result = await postOnce<{ results: DbQueryResult[] }>(
        "/api/v1/execute",
        { statements },
      );
      return result.results;
    },

    async call<T>(path: string, body: unknown): Promise<T> {
      return postOnce<T>(path, body);
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
