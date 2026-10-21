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
import { test, expect, expectPathname } from "./fixtures";

test("Native sidebar groups, current state, collapsed tooltips and search remain interactive", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/posts/new", { waitUntil: "networkidle" });
  const sidebar = page.getByRole("complementary");
  const posts = sidebar.getByRole("button", { name: "文章", exact: true });
  await expect(posts).toHaveAttribute("data-sidebar-row", "");
  await expect(posts).toHaveAttribute("aria-current", "page");
  await expect(sidebar.locator('[data-slot="sidebar-group"]')).toHaveCount(4);
  const content = sidebar.getByRole("button", { name: "内容", exact: true });
  await content.click();
  await expect(content).toHaveAttribute("aria-expanded", "false");
  await expect(posts).toBeHidden();
  await content.click();
  await expect(posts).toBeVisible();

  await page.getByRole("button", { name: "收起侧边栏", exact: true }).click();
  await expect.poll(() => sidebar.evaluate((node) => node.getBoundingClientRect().width)).toBe(68);
  await posts.hover();
  await expect(page.getByRole("tooltip", { name: "文章", exact: true })).toBeVisible();
  await sidebar.getByRole("button", { name: "搜索 (⌘K)", exact: true }).click();
  const search = page.getByRole("textbox", { name: "搜索文章或跳转页面...", exact: true });
  await expect(search).toBeVisible();
  await expect(search).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(search).toBeHidden();
  await posts.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/posts$/);
});

test("Native sidebar preserves external and modified-click new tabs", async ({ page, context }) => {
  await page.goto("/admin/posts", { waitUntil: "networkidle" });
  const sidebar = page.getByRole("complementary");
  for (const modifiers of [["ControlOrMeta"], ["Shift"]] as const) {
    const popupPromise = context.waitForEvent("page");
    await sidebar.getByRole("button", { name: "分类", exact: true }).click({ modifiers: [...modifiers] });
    const popup = await popupPromise;
    await expect(popup).toHaveURL(/\/admin\/categories$/);
    expect(await popup.evaluate(() => window.opener)).toBeNull();
    await popup.close();
    await expect(page).toHaveURL(/\/admin\/posts$/);
  }
  for (const [name, button, path] of [["分类", "middle", "/admin/categories"], ["访问站点", "left", "/"]] as const) {
    const popupPromise = context.waitForEvent("page");
    await sidebar.getByRole("button", { name, exact: true }).click({ button });
    const popup = await popupPromise;
    await expect(popup).toHaveURL(new RegExp(`${path}$`));
    expect(await popup.evaluate(() => window.opener)).toBeNull();
    await popup.close();
    await expect(page).toHaveURL(/\/admin\/posts$/);
  }
});

test("Given the desktop sidebar, When collapse and expansion settle, Then the brand mark has the same horizontal position", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/posts", { waitUntil: "networkidle" });
  const sidebar = page.getByRole("complementary");
  const logo = sidebar.getByRole("img", { name: "Firefly", exact: true });
  await expect(logo).toBeVisible();
  const expandedX = await logo.evaluate((node) => node.getBoundingClientRect().x);

  await page.getByRole("button", { name: "收起侧边栏", exact: true }).click();
  await expect.poll(() => sidebar.evaluate((node) => node.getBoundingClientRect().width)).toBe(68);
  await expect.poll(async () => Math.abs(await logo.evaluate((node) => node.getBoundingClientRect().x) - expandedX)).toBeLessThan(1);

  await page.getByRole("button", { name: "展开侧边栏", exact: true }).click();
  await expect.poll(() => sidebar.evaluate((node) => node.getBoundingClientRect().width)).toBe(260);
  await expect.poll(async () => Math.abs(await logo.evaluate((node) => node.getBoundingClientRect().x) - expandedX)).toBeLessThan(1);
});

for (const width of [390, 700]) {
  test(`Given a ${width}px viewport, When I open navigation, Then it fits the drawer and closes accessibly`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/posts", { waitUntil: "networkidle" });
    const opener = page.getByRole("button", { name: "打开导航", exact: true });
    await opener.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveCSS("padding", "0px");
    await expect.poll(() => drawer.evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
    await expect(drawer.getByRole("complementary")).toHaveCSS("width", "260px");

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
    await opener.click();
    await drawer.getByRole("button", { name: "分类", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/categories$/);
    await expect(drawer).toBeHidden();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(opener).toBeHidden();
    await expect(page.getByRole("complementary")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

// ---------------------------------------------------------------------------
// Feature: Admin dashboard shell + content stats
// ---------------------------------------------------------------------------

test.describe("Feature: Admin dashboard shell + content stats", () => {
  test("Given E2E auth bypass is active, When I use the native sidebar, Then the posts destination navigates to /admin/posts", async ({
    page,
  }) => {
    // Given: E2E auth bypass is active.
    // When: visit the dashboard.
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

    await sidebarNav.getByRole("button", { name: "文章", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/posts$/);
    await expect(sidebarNav.getByRole("button", { name: "文章", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("Given /admin renders, When I view it, Then the 概览 h1 and the content-stat cards (已发布文章 / 分类 / 标签) are visible", async ({
    page,
  }) => {
    // Given: E2E auth bypass is active.
    // When: visit the dashboard.
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin");

    // Then: the AdminShell top-bar <h1> renders the dashboard title from
    // i18n key "admin.page.dashboard" → "概览" (src/lib/i18n/index.ts:34).
    await expect(
      page.getByRole("heading", { level: 1, name: "概览" }).first(),
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
    // Given: E2E auth bypass is active.
    // When: visit the dashboard.
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin");

    // Then: the dashboard h1 is visible (same readiness signal AdminShell
    // exposes via the top-bar title).
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
