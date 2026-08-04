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

// ---------------------------------------------------------------------------
// Bounded-concurrency queue (STU-2495)
// ---------------------------------------------------------------------------
//
// Defensive hypothesis pending CI evidence. What the merged-into-main run
// 30901699318 actually shows is only that (a) the worker log has every
// request returning 200 OK and (b) Next.js throws generic
// `TypeError: fetch failed` in bursts. It does not identify the transport
// layer that is dropping traffic — accept-backlog / undici pool / kernel
// FD table are all plausible; we cannot pick one without an `err.cause.code`
// that isn't just "fetch failed". The queue is a bounded circuit breaker
// that removes the burst regardless of which layer is failing; it is not a
// confirmed root-cause fix.
//
// FdQueue caps concurrent in-flight fetches to a small pool. New callers
// wait FIFO. Kept scoped to localhost so production request throughput is
// unchanged.
class FdQueue {
  private active = 0;
  private waiters: Array<() => void> = [];
  constructor(private readonly max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    // Acquire. If we go through the waiter path we do NOT increment
    // `active` here — the releaser hands the permit over directly.
    if (this.active >= this.max) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    } else {
      this.active++;
    }
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /** Direct handoff on release: if a waiter is queued it inherits our
   *  permit, so `active` never dips below capacity in the microtask gap
   *  and a late caller cannot barge in ahead of the queued waiter. */
  private release(): void {
    const next = this.waiters.shift();
    if (next) {
      // Permit stays consumed; waiter continuation runs fn() with it.
      next();
    } else {
      this.active--;
    }
  }
}

const LOCAL_MAX_CONCURRENCY = 4;

// Registry keyed by localhost `origin` (protocol + host + port). All
// `createDb()` calls in this runtime that target the same localhost origin
// share the same queue so `getDb()` (src/lib/db.ts), the tracking singleton
// (src/lib/tracking.ts:81-88), and the per-request client in
// `src/proxy.ts:327,340` do not each get their own 4-permit budget.
//
// The registry lives on `globalThis` under a Symbol.for() key so that every
// copy of this module in the same `globalThis` realm resolves to the same Map.
// This matters because Turbopack ships separate `moduleCache` instances for
// the server and SSR runtimes (see `.next/server/chunks/[turbopack]_runtime.js`
// and `.../ssr/[turbopack]_runtime.js`); a plain module-scope Map would give
// each runtime its own 4-permit queue and the per-process ceiling would be
// 4 × N. `Symbol.for("firefly.db.localQueues.v1")` is shared across bundler
// module caches inside one realm; distinct realms (worker_threads /
// vm.createContext) each hold their own Map by design.
type LocalQueuesRegistry = Map<string, FdQueue>;
const _localQueuesKey: symbol = Symbol.for("firefly.db.localQueues.v1");
type GlobalRegistryHost = { [K in typeof _localQueuesKey]?: LocalQueuesRegistry };

function getLocalQueues(): LocalQueuesRegistry {
  const host = globalThis as unknown as GlobalRegistryHost;
  let map = host[_localQueuesKey];
  if (!map) {
    map = new Map<string, FdQueue>();
    host[_localQueuesKey] = map;
  }
  return map;
}

function localhostQueueFor(workerUrl: string): FdQueue | null {
  if (!LOCALHOST_RE.test(workerUrl)) return null;
  let key: string;
  try {
    key = new URL(workerUrl).origin;
  } catch {
    return null;
  }
  const registry = getLocalQueues();
  let q = registry.get(key);
  if (!q) {
    q = new FdQueue(LOCAL_MAX_CONCURRENCY);
    registry.set(key, q);
  }
  return q;
}

// Internal test hooks. Tree-shaken from production chunks because no
// runtime code path outside `src/lib/db.test.ts` reads them.
export function _resetLocalQueuesForTest(): void {
  getLocalQueues().clear();
}

export const _internalTestHooks = {
  FdQueue,
  getLocalQueues,
  LOCAL_MAX_CONCURRENCY,
  registryKey: _localQueuesKey,
};

export function createDb(workerUrl: string, workerSecret: string): Db {
  if (!workerUrl) throw new Error("workerUrl is required");
  if (!workerSecret) throw new Error("workerSecret is required");

  const isLocal = LOCALHOST_RE.test(workerUrl);
  const retryDelays = isLocal ? LOCAL_RETRY_DELAYS_MS : REMOTE_RETRY_DELAYS_MS;

  // Shared queue lookup by localhost origin — see `_localQueues` above.
  const queue = localhostQueueFor(workerUrl);
  const gated = <T>(fn: () => Promise<T>): Promise<T> =>
    queue ? queue.run(fn) : fn();

  // Keep-alive is retained on localhost too: STU-2495 tried `Connection:
  // close` but the CI evidence (all requests 200 server-side, client fetch
  // throwing) shows nothing pointing at stale sockets — while an extra
  // TCP handshake per request only worsens accept-backlog pressure. The
  // bounded queue above is what actually keeps burst load off the pipe.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${workerSecret}`,
  };

  async function postOnce<T>(path: string, body: unknown): Promise<T> {
    return gated<T>(async () => {
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
    });
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
