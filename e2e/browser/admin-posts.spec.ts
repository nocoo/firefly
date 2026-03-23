import { test, expect } from "@playwright/test";

test.describe("Admin post management", () => {
  test("admin dashboard loads (with E2E_SKIP_AUTH)", async ({ page }) => {
    await page.goto("/admin");
    // With E2E_SKIP_AUTH=true, admin should be accessible
    // It may redirect to /admin/posts or show a dashboard
    await expect(page.url()).toMatch(/\/admin/);
    await page.waitForLoadState("networkidle");
  });

  test("admin posts list loads", async ({ page }) => {
    await page.goto("/admin/posts");
    await page.waitForLoadState("networkidle");

    // Should show a heading or table/list of posts
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("admin new post page loads", async ({ page }) => {
    await page.goto("/admin/editor");
    await page.waitForLoadState("networkidle");

    // Should show an editor form with title input or content area
    const formElement = page.locator("input, textarea, [contenteditable]").first();
    await expect(formElement).toBeVisible({ timeout: 10_000 });
  });

  test("admin stats page loads", async ({ page }) => {
    await page.goto("/admin/stats");
    await page.waitForLoadState("networkidle");

    // Stats page should render analytics widgets
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});
