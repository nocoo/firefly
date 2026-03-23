import { test, expect } from "@playwright/test";

test.describe("Blog navigation", () => {
  test("home page loads with blog posts", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/lizheng/i);

    // Should have at least one article or post link
    const articles = page.locator("article, [data-testid='post-card'], a[href*='/20']");
    await expect(articles.first()).toBeVisible({ timeout: 10_000 });
  });

  test("category page loads", async ({ page }) => {
    // Navigate to home first, then find a category link
    await page.goto("/");

    const categoryLink = page.locator("a[href^='/category/']").first();
    if (await categoryLink.isVisible()) {
      await categoryLink.click();
      await expect(page.url()).toContain("/category/");
      await expect(page.locator("h1, h2").first()).toBeVisible();
    }
  });

  test("tag page loads", async ({ page }) => {
    await page.goto("/");

    const tagLink = page.locator("a[href^='/tag/']").first();
    if (await tagLink.isVisible()) {
      await tagLink.click();
      await expect(page.url()).toContain("/tag/");
      await expect(page.locator("h1, h2").first()).toBeVisible();
    }
  });

  test("archive page loads", async ({ page }) => {
    // No /archive index exists; use current year as the archive period
    const year = new Date().getFullYear();
    await page.goto(`/archive/${year}`);
    // Archive page should list posts grouped by month
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});
