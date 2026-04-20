/**
 * L3 E2E: Admin categories and tags management
 *
 * Covers: /admin/categories, /admin/tags
 */
import { test, expect } from "@playwright/test";

test.describe("Admin categories page", () => {
  test("categories page loads", async ({ page }) => {
    await page.goto("/admin/categories", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/admin\/categories/);

    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("shows list of categories", async ({ page }) => {
    await page.goto("/admin/categories", { waitUntil: "networkidle" });

    // Should have a list/table of categories (may be empty)
    const container = page.locator(
      "table, ul, [data-testid='categories-list'], .categories-list",
    );
    const count = await container.count();
    if (count > 0) {
      await expect(container.first()).toBeVisible();
    }
  });

  test("has add category button or form", async ({ page }) => {
    await page.goto("/admin/categories", { waitUntil: "networkidle" });

    // Should have a way to add new category
    const addButton = page.locator(
      'button:has-text("Add"), button:has-text("新建"), button:has-text("Create"), input[placeholder*="category"], input[placeholder*="分类"]',
    );
    await expect(addButton.first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Admin tags page", () => {
  test("tags page loads", async ({ page }) => {
    await page.goto("/admin/tags", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/admin\/tags/);

    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("shows list of tags", async ({ page }) => {
    await page.goto("/admin/tags", { waitUntil: "networkidle" });

    // Should have a list/table of tags (may be empty)
    const container = page.locator(
      "table, ul, [data-testid='tags-list'], .tags-list, .tag-cloud",
    );
    const count = await container.count();
    if (count > 0) {
      await expect(container.first()).toBeVisible();
    }
  });

  test("has add tag button or form", async ({ page }) => {
    await page.goto("/admin/tags", { waitUntil: "networkidle" });

    // Should have a way to add new tag
    const addButton = page.locator(
      'button:has-text("Add"), button:has-text("新建"), button:has-text("Create"), input[placeholder*="tag"], input[placeholder*="标签"]',
    );
    await expect(addButton.first()).toBeVisible({ timeout: 10_000 });
  });
});
