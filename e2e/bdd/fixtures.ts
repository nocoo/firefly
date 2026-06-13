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
 * Navigate to an admin route. The L3 runner sets `E2E_SKIP_AUTH=1` so the
 * admin guard accepts unauthenticated sessions; this helper centralises that
 * convention and waits for the admin shell to be ready (the top-bar <h1>
 * page title is rendered by AdminShell once the layout mounts).
 */
export async function gotoAdmin(page: Page, path = ""): Promise<void> {
  const target = `/admin${path.startsWith("/") ? path : path ? `/${path}` : ""}`;
  await page.goto(target, { waitUntil: "networkidle" });
  // Readiness signal: AdminShell renders its <h1> page title once mounted.
  await page.getByRole("heading", { level: 1 }).first().waitFor({
    state: "visible",
    timeout: 10_000,
  });
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
