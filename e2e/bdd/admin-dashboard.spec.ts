/**
 * L3 BDD: Admin dashboard shell + readiness + content stats.
 *
 * Phase 2.2 of L3 → BDD migration (see docs/25-l3-bdd-refactor.md §3, §4.2).
 *
 * Source spec attribution (3 migrated; admin-posts.spec.ts retains 8 for Phase 3.4):
 *   - browser/admin-posts.spec.ts L8-19  "Admin dashboard > dashboard loads with sidebar navigation"
 *   - browser/admin-posts.spec.ts L21-27 "Admin dashboard > dashboard shows stats widgets"
 *   - browser/admin-posts.spec.ts L117-125 "Admin analytics page > analytics page loads"
 *     (the old "analytics" test navigates /admin and asserts a generic heading;
 *      it is a dashboard readiness smoke, not a separate analytics page test —
 *      labelled as such here to avoid overclaiming coverage.)
 *
 * Mapping (old test → new scenario):
 *   "Admin dashboard > dashboard loads with sidebar navigation"
 *       → "Given E2E auth bypass is active, ... /admin renders the AdminShell sidebar (aside + nav) and a /admin/posts nav link"
 *   "Admin dashboard > dashboard shows stats widgets"
 *       → "Given /admin renders, ... the dashboard h1 (概览) and the 已发布文章 / 分类 / 标签 content-stat cards are visible"
 *   "Admin analytics page > analytics page loads"
 *       → "Given /admin renders, ... the dashboard readiness smoke (pathname + h1) passes"
 *         (intentionally narrower than the old test name: this is dashboard
 *          smoke, not analytics-page smoke; there is no /admin/analytics route.)
 *
 * Retained in browser/admin-posts.spec.ts for Phase 3.4 (NOT deleted by this phase):
 *   - "Admin posts list > posts list page loads"
 *   - "Admin posts list > posts list shows table or grid of posts"
 *   - "Admin posts list > has new post button"
 *   - "Admin posts list > clicking new post navigates to editor"
 *   - "Admin post editor - new post > new post page loads with editor form"
 *   - "Admin post editor - new post > editor has content area"
 *   - "Admin post editor - new post > editor has publish/save buttons"
 *   - "Admin post editor - new post > can enter title in editor"
 *   (3 migrated + 8 retained = 11 tests in the source file.)
 */
import { test, expect } from "./fixtures";

// ---------------------------------------------------------------------------
// Local helper — path-level URL guard (same pattern as auth.spec.ts).
// ---------------------------------------------------------------------------

/**
 * Assert that the current page's pathname is exactly `expected`. Path-level
 * comparison so that a future regression which redirects /admin* to
 * /login?callbackUrl=/admin cannot pass a loose toHaveURL regex.
 */
async function expectPathname(
  page: import("@playwright/test").Page,
  expected: string,
): Promise<void> {
  const { pathname } = new URL(page.url());
  expect(pathname).toBe(expected);
}

// ---------------------------------------------------------------------------
// Feature: Admin dashboard shell + content stats
// ---------------------------------------------------------------------------

test.describe("Feature: Admin dashboard shell + content stats", () => {
  test("Given E2E auth bypass is active, When I open /admin, Then the AdminShell sidebar exposes an aside, a nav, and a /admin/posts link", async ({
    page,
  }) => {
    // Given/When: visit the dashboard
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin");

    // Then: the sidebar <aside> (AdminSidebar root, src/components/admin/sidebar.tsx:187)
    // is visible. ARIA role for <aside> is "complementary"; using getByRole
    // keeps this on the semantic landmark instead of a CSS tag selector.
    const sidebar = page.getByRole("complementary").first();
    await expect(sidebar).toBeVisible();

    // Then: the sidebar's own <nav> (sidebar.tsx:231/321) is visible.
    // Scoping to the sidebar avoids matching pagination/breadcrumb <nav>
    // elements that other admin routes may also render.
    const sidebarNav = sidebar.getByRole("navigation").first();
    await expect(sidebarNav).toBeVisible();

    // Then: the sidebar exposes a /admin/posts link. Scoped to sidebarNav
    // so the scenario actually fails if the sidebar drops this nav item
    // even though some other page region (command palette, breadcrumb)
    // still renders an /admin/posts link.
    await expect(
      sidebarNav.locator('a[href^="/admin/posts"]').first(),
    ).toBeVisible();
  });

  test("Given /admin renders, When I view it, Then the 概览 h1 and the content-stat cards (已发布文章 / 分类 / 标签) are visible", async ({
    page,
  }) => {
    // Given/When: visit the dashboard
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin");

    // Then: the AdminShell top-bar <h1> renders the dashboard title from
    // i18n key "admin.page.dashboard" → "概览" (src/lib/i18n/index.ts:34).
    await expect(
      page.getByRole("heading", { level: 1, name: "概览" }),
    ).toBeVisible({ timeout: 10_000 });

    // Then: the three ContentStatCard labels are visible. The labels are
    // rendered as <p> elements inside ContentStatCard
    // (src/components/admin/analytics-dashboard.tsx:343); scoping to the
    // paragraph role disambiguates from sidebar nav links that share the
    // same text ("分类" / "标签" also appear in the sidebar AdminSidebar nav).
    await expect(
      page.getByRole("paragraph").filter({ hasText: "已发布文章" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("paragraph").filter({ hasText: /^分类$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("paragraph").filter({ hasText: /^标签$/ }),
    ).toBeVisible();
  });

  test("Given /admin renders, When I view it, Then the dashboard readiness smoke (pathname + h1) passes", async ({
    page,
  }) => {
    // Note: the original "Admin analytics page > analytics page loads" test
    // navigated /admin (not a dedicated /admin/analytics route) and only
    // asserted a generic heading. This scenario preserves that coverage as
    // dashboard readiness — there is no separate analytics page in the
    // current admin shell.
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin");

    // Then: the dashboard h1 is visible (same readiness signal AdminShell
    // exposes via the top-bar title).
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
