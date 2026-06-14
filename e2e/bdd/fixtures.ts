/**
 * Shared L3 BDD fixtures.
 *
 * Scope is intentionally narrow (see docs/25-l3-bdd-refactor.md §2.4):
 *   1. Stable navigation helpers used across multiple specs
 *   2. Empty-data gating that surfaces as Playwright `test.skip()`
 *   3. Admin auth-bypass entry that wraps the `E2E_SKIP_AUTH` convention
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

export { base as test, expect };
