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
 * This module intentionally lives under src/lib so it participates in the
 * main vitest suite (e2e/** is Playwright-only). The Playwright fixtures
 * re-export it from e2e/bdd/fixtures.ts.
 */

const SEED_BACKOFF_MS = [250, 500, 1000] as const;

export interface SeedPostBody {
  title: string;
  slug: string;
  content: string;
  status: "published";
  published_at: number;
}

/** Test seam — swap `fetch` and `sleep` for fault-injection tests. */
export interface SeedDeps {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
}

export const defaultSeedDeps: SeedDeps = {
  fetch: (input, init) => fetch(input, init),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

async function slugExists(
  deps: SeedDeps,
  baseUrl: string,
  slug: string,
): Promise<boolean> {
  try {
    const res = await deps.fetch(
      `${baseUrl}/api/posts/${encodeURIComponent(slug)}`,
      { method: "GET" },
    );
    return res.ok;
  } catch {
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
): Promise<AttemptResult> {
  let res: Response;
  try {
    res = await deps.fetch(`${baseUrl}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
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
  const attempts = SEED_BACKOFF_MS.length + 1;
  let lastDetail = "";
  for (let i = 0; i < attempts; i++) {
    const attempt = await attemptSeed(deps, baseUrl, body);
    if (attempt.ok) return;
    lastDetail = attempt.detail;

    if (attempt.kind === "4xx") {
      throw new Error(`Failed to seed post: ${attempt.detail}`);
    }

    if (await slugExists(deps, baseUrl, body.slug)) return;
    if (i === attempts - 1) break;
    await deps.sleep(SEED_BACKOFF_MS[i] ?? 0);
  }
  throw new Error(
    `Failed to seed post after ${attempts} attempts: ${lastDetail}`,
  );
}
