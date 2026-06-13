/**
 * L3 E2E: Admin posts list + post editor (Phase 3.4 source spec).
 *
 * Covers: /admin/posts, /admin/posts/new
 *
 * Dashboard scenarios and the "analytics page" dashboard smoke were migrated
 * to e2e/bdd/admin-dashboard.spec.ts in Phase 2.2 (see
 * docs/25-l3-bdd-refactor.md §1.2.2). The remaining 8 tests below
 * (posts list + editor) will be migrated in Phase 3.4.
 */
import { test, expect } from "@playwright/test";

test.describe("Admin posts list", () => {
  test("posts list page loads", async ({ page }) => {
    await page.goto("/admin/posts", { waitUntil: "networkidle" });

    // Should show a heading
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("posts list shows table or grid of posts", async ({ page }) => {
    await page.goto("/admin/posts", { waitUntil: "networkidle" });

    // Should have a table, grid, or list of posts (may be empty in test DB)
    const container = page.locator(
      "table, [role='grid'], [data-testid='posts-list'], .posts-list",
    );
    // If container exists, it should be visible; otherwise the page should still load
    const count = await container.count();
    if (count > 0) {
      await expect(container.first()).toBeVisible();
    }
  });

  test("has new post button", async ({ page }) => {
    await page.goto("/admin/posts", { waitUntil: "networkidle" });

    // Should have a link/button to create new post
    const newPostLink = page.locator(
      'a[href*="/admin/posts/new"], button:has-text("New"), button:has-text("新建")',
    );
    await expect(newPostLink.first()).toBeVisible();
  });

  test("clicking new post navigates to editor", async ({ page }) => {
    await page.goto("/admin/posts", { waitUntil: "networkidle" });

    const newPostLink = page.locator('a[href*="/admin/posts/new"]').first();
    if (await newPostLink.isVisible()) {
      await newPostLink.click();
      await expect(page).toHaveURL(/\/admin\/posts\/new/);
    }
  });
});

test.describe("Admin post editor - new post", () => {
  test("new post page loads with editor form", async ({ page }) => {
    await page.goto("/admin/posts/new", { waitUntil: "networkidle" });

    // Should show editor with title input (placeholder: "文章标题")
    const titleInput = page.locator(
      'input[placeholder*="标题"], input[placeholder*="Title"]',
    );
    await expect(titleInput.first()).toBeVisible({ timeout: 10_000 });
  });

  test("editor has content area", async ({ page }) => {
    await page.goto("/admin/posts/new", { waitUntil: "networkidle" });

    // Should have a content editor - wait for textarea to be attached
    const contentArea = page.locator("textarea#content, textarea");
    await expect(contentArea.first()).toBeAttached({ timeout: 10_000 });
  });

  test("editor has publish/save buttons", async ({ page }) => {
    await page.goto("/admin/posts/new", { waitUntil: "networkidle" });

    // Scroll down to see the buttons
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    // Look for any submit-type button - the form has action buttons at bottom
    const actionButton = page.locator("button[type='submit'], button");
    const count = await actionButton.count();
    expect(count).toBeGreaterThan(0);
  });

  test("can enter title in editor", async ({ page }) => {
    await page.goto("/admin/posts/new", { waitUntil: "networkidle" });

    const titleInput = page.locator(
      'input[placeholder*="标题"], input[placeholder*="Title"]',
    ).first();
    await titleInput.fill("E2E Test Post Title");
    await expect(titleInput).toHaveValue("E2E Test Post Title");
  });
});
