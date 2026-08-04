/**
 * Idempotent E2E seed helper (STU-2495).
 *
 * The Next.js → wrangler-dev worker channel throws `fetch failed` under
 * L3 Playwright load (see .wrangler/e2e-logs/next-*.log after any failure).
 * Under those flakes Next.js may return HTTP 5xx even though the underlying
 * D1 write committed, so a 5xx cannot be treated as "did nothing." We
 * reconcile by the UNIQUE `posts.slug` column:
 *
 *   - fetch throw       → GET-check; hit ⇒ done, miss ⇒ wait, retry POST
 *   - server 5xx        → same as fetch throw (ambiguous — may have committed)
 *   - server 4xx        → fail fast, no reconcile, no retry (client bug —
 *                         retrying will fail identically and reconcile could
 *                         mask a real 4xx by finding a slug some prior test
 *                         seeded)
 *
 * The reconcile GET path is `/api/posts/:slug`, which only returns published
 * posts (src/app/api/posts/[slug]/route.ts). Callers must therefore seed
 * with `status: "published"` — the type below enforces that.
 *
 * SEED_TOTAL_DEADLINE_MS is enforced by a real AbortController that fires
 * a single hard timer at deadline time; POST + reconcile GET both pass its
 * signal into fetch(), so an in-flight request that never resolves is
 * cancelled at exactly the deadline instead of blocking the loop. Any
 * abort caused by our own timer is normalised into a "before deadline"
 * diagnostic so Playwright surfaces the helper's message, not a generic
 * 30 s hook timeout.
 *
 * This module intentionally lives under src/lib so it participates in the
 * main vitest suite (e2e/** is Playwright-only). The Playwright fixtures
 * re-export it from e2e/bdd/fixtures.ts.
 */

// Backoff schedule between attempts. Sleeps themselves are also raced
// against the deadline via the AbortController's signal.
const SEED_BACKOFF_MS = [250, 500, 1000, 3000, 6000] as const;

// Total wall-clock budget for seedPostIdempotent, kept comfortably below
// Playwright's 30 s hook timeout so the helper's own diagnostic message
// wins if the channel never recovers. If a caller (or the Playwright
// config) changes hookTimeout, both should move together.
export const SEED_TOTAL_DEADLINE_MS = 20_000;

export interface SeedPostBody {
  title: string;
  slug: string;
  content: string;
  status: "published";
  published_at: number;
}

/** Test seam — swap the entire timer/scheduler surface for fault-injection. */
export interface SeedDeps {
  /** fetch stand-in. MUST honour AbortSignal — seedPostIdempotent uses it
   *  to hard-cancel in-flight requests at deadline. */
  fetch: (
    input: string,
    init: RequestInit & { signal: AbortSignal },
  ) => Promise<Response>;
  /** Sleep that is cancelled when signal aborts (returns early). */
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  /** Fires `onFire()` after `ms` real time; returns a cancel handle. Used
   *  to schedule the single hard deadline abort. */
  setTimer: (onFire: () => void, ms: number) => () => void;
}

export const defaultSeedDeps: SeedDeps = {
  fetch: (input, init) => fetch(input, init),
  sleep: (ms, signal) =>
    new Promise((resolve) => {
      // If signal is already aborted, abort events do NOT re-fire — resolve
      // synchronously so the caller can check signal.aborted and exit.
      if (signal.aborted) {
        resolve();
        return;
      }
      const onAbort = () => {
        clearTimeout(t);
        signal.removeEventListener("abort", onAbort);
        resolve();
      };
      const t = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      signal.addEventListener("abort", onAbort, { once: true });
    }),
  setTimer: (onFire, ms) => {
    const t = setTimeout(onFire, ms);
    return () => clearTimeout(t);
  },
};

class DeadlineAbortError extends Error {
  constructor() {
    super("SeedDeadline");
    this.name = "DeadlineAbortError";
  }
}

async function slugExists(
  deps: SeedDeps,
  baseUrl: string,
  slug: string,
  signal: AbortSignal,
): Promise<boolean> {
  try {
    const res = await deps.fetch(
      `${baseUrl}/api/posts/${encodeURIComponent(slug)}`,
      { method: "GET", signal },
    );
    return res.ok;
  } catch (err) {
    // Do NOT swallow a deadline abort — propagate so the loop stops
    // immediately instead of falling into the next sleep/retry with an
    // already-aborted signal.
    if (signal.aborted) throw err;
    return false;
  }
}

type AttemptResult =
  | { ok: true }
  | { ok: false; kind: "throw" | "5xx" | "4xx"; detail: string };

async function attemptSeed(
  deps: SeedDeps,
  baseUrl: string,
  body: SeedPostBody,
  signal: AbortSignal,
): Promise<AttemptResult> {
  let res: Response;
  try {
    res = await deps.fetch(`${baseUrl}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (signal.aborted) throw err; // let the deadline handler own aborts
    return {
      ok: false,
      kind: "throw",
      detail: `throw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (res.ok) return { ok: true };
  const text = await res.text().catch(() => "");
  const detail = `${res.status} ${text}`;
  if (res.status >= 400 && res.status < 500) {
    return { ok: false, kind: "4xx", detail };
  }
  return { ok: false, kind: "5xx", detail };
}

export async function seedPostIdempotent(
  baseUrl: string,
  body: SeedPostBody,
  deps: SeedDeps = defaultSeedDeps,
): Promise<void> {
  const controller = new AbortController();
  const signal = controller.signal;
  const cancelTimer = deps.setTimer(
    () => controller.abort(new DeadlineAbortError()),
    SEED_TOTAL_DEADLINE_MS,
  );

  const attempts = SEED_BACKOFF_MS.length + 1;
  let lastDetail = "";
  let attemptsRun = 0;
  try {
    for (let i = 0; i < attempts; i++) {
      attemptsRun = i + 1;
      const attempt = await attemptSeed(deps, baseUrl, body, signal);
      if (attempt.ok) return;
      lastDetail = attempt.detail;

      if (attempt.kind === "4xx") {
        throw new Error(`Failed to seed post: ${attempt.detail}`);
      }

      if (await slugExists(deps, baseUrl, body.slug, signal)) return;
      if (i === attempts - 1) break;

      const wait = SEED_BACKOFF_MS[i] ?? 0;
      await deps.sleep(wait, signal);
      if (signal.aborted) break;
    }
    throw new Error(
      `Failed to seed post after ${attempts} attempts: ${lastDetail}`,
    );
  } catch (err) {
    if (signal.aborted && signal.reason instanceof DeadlineAbortError) {
      throw new Error(
        `Failed to seed post before deadline (${SEED_TOTAL_DEADLINE_MS}ms) after ${attemptsRun} attempts: ${
          lastDetail || "no attempt completed"
        }`,
      );
    }
    throw err;
  } finally {
    cancelTimer();
  }
}
