/**
 * Shared L3 BDD fixtures.
 *
 * Scope is intentionally narrow (see docs/25-l3-bdd-refactor.md §2.4):
 *   1. Stable navigation helpers used across multiple specs
 *   2. Empty-data gating that surfaces as Playwright `test.skip()`
 *   3. Admin auth-bypass entry that wraps the `E2E_SKIP_AUTH` convention
 *   4. Idempotent seed helper — reconciles POST /api/posts against a
 *      transient network flake by rechecking the slug on failure.
 *
 * Do NOT add per-spec helpers, business-assertion helpers, or fallback
 * selectors here.
 */
import { test as base, expect, type Page } from "@playwright/test";

/**
 * Navigate from the home page to the first published post detail.
 * Returns the resolved URL on success, or `null` when the test DB has no
 * published post — callers should pair this with `test.skip()`.
 */
export async function gotoFirstPost(page: Page): Promise<string | null> {
  await page.goto("/", { waitUntil: "networkidle" });
  // Home renders blog posts inside <article> via PostCard (semantic landmark).
  const firstArticle = page.getByRole("article").first();
  if ((await firstArticle.count()) === 0) return null;
  // Each PostCard has a single linked title (an <h2> wrapping a <Link>).
  const postLink = firstArticle.getByRole("link").first();
  if ((await postLink.count()) === 0) return null;
  await postLink.click();
  await page.waitForURL(/\/\d{4}\/\d{2}\//, { timeout: 10_000 });
  return page.url();
}

/**
 * Assert the page is currently on the expected pathname, ignoring host,
 * search, and hash. Admin specs use this to lock down navigation outcomes
 * so a substring URL check cannot pass on a redirected route.
 */
export async function expectPathname(
  page: Page,
  expected: string,
): Promise<void> {
  const { pathname } = new URL(page.url());
  expect(pathname).toBe(expected);
}

export interface EmptyDataGate {
  skip: boolean;
  reason: string;
}

/**
 * Inspect a count and produce a gate the caller consumes via
 * `test.skip(gate.skip, gate.reason)`.
 *
 * Using Playwright's real `test.skip()` (instead of an early `return`)
 * keeps the skip visible in reports and CI logs.
 */
export function emptyDataGate(count: number, what: string): EmptyDataGate {
  return count === 0
    ? {
        skip: true,
        reason: `Test DB has no ${what}; seed required.`,
      }
    : { skip: false, reason: "" };
}

// ---------------------------------------------------------------------------
// Idempotent seed helper (STU-2495)
// ---------------------------------------------------------------------------
//
// The Next.js → wrangler-dev channel throws `fetch failed` under L3 load
// (see .wrangler/e2e-logs/next-*.log after any failure). Both the seed POST
// and the Worker-side db.execute() can throw, but the `slug` column is
// UNIQUE, so we reconcile by GET-checking after any failure:
//   - GET success       → seed exists (this call or a prior one committed)
//   - server 4xx/5xx    → GET-check; if committed we succeed, otherwise
//                         wait and retry once more
//   - fetch throw       → same as above
//
// We use up to 4 attempts with jittered backoff to survive back-to-back
// throws under Playwright's 10-worker load.
// ---------------------------------------------------------------------------

const SEED_BACKOFF_MS = [250, 500, 1000] as const;

export interface SeedPostBody {
  title: string;
  slug: string;
  content: string;
  status: "published" | "draft" | "archived" | "private";
  published_at: number;
}

async function slugExists(baseUrl: string, slug: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/posts/${encodeURIComponent(slug)}`, {
      method: "GET",
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function attemptSeed(
  baseUrl: string,
  body: SeedPostBody,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  try {
    const res = await fetch(`${baseUrl}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    return { ok: false, detail: `${res.status} ${await res.text()}` };
  } catch (err) {
    return {
      ok: false,
      detail: `throw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function seedPostIdempotent(
  baseUrl: string,
  body: SeedPostBody,
): Promise<void> {
  const attempts = SEED_BACKOFF_MS.length + 1;
  let lastDetail = "";
  for (let i = 0; i < attempts; i++) {
    const attempt = await attemptSeed(baseUrl, body);
    if (attempt.ok) return;
    lastDetail = attempt.detail;
    // Either fetch threw or Next.js returned 5xx (usually because its
    // downstream db.execute threw). In either case the write may have
    // committed anyway — reconcile by unique slug.
    if (await slugExists(baseUrl, body.slug)) return;
    if (i === attempts - 1) break;
    await new Promise((r) => setTimeout(r, SEED_BACKOFF_MS[i] ?? 0));
  }
  throw new Error(`Failed to seed post after ${attempts} attempts: ${lastDetail}`);
}

export { base as test, expect };
