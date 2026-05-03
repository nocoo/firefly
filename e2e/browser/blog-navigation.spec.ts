import { test, expect } from "@playwright/test";

test.describe("Blog navigation", () => {
  test("home page loads with blog posts", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    // Title should be non-empty — the actual site name is user-configurable
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // Test DB may have zero published posts. Only assert articles if present.
    const articles = page.locator("article, [data-testid='post-card'], a[href*='/20']");
    const count = await articles.count();
    if (count > 0) {
      await expect(articles.first()).toBeVisible();
    }
  });

  test("post card displays title, date, and links to post", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const article = page.locator("article").first();
    if ((await article.count()) === 0) return;

    await expect(article.locator("h2")).toBeVisible();
    await expect(article.locator("time")).toBeVisible();

    const link = article.locator("h2 a");
    const href = await link.getAttribute("href");
    expect(href).toMatch(/\/\d{4}\/\d{2}\//);
  });

  test("clicking post title navigates to post detail", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const postLink = page.locator("article h2 a").first();
    if ((await postLink.count()) === 0) return;

    await postLink.click();
    await page.waitForURL(/\/\d{4}\/\d{2}\//, { timeout: 10_000 });
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("category page loads", async ({ page }) => {
    // Navigate to home first, then find a category link
    await page.goto("/");

    const categoryLink = page.locator("a[href^='/category/']").first();
    if (await categoryLink.isVisible()) {
      await Promise.all([
        page.waitForURL(/\/category\//, { timeout: 10_000 }),
        categoryLink.click(),
      ]);
      await expect(page.locator("h1, h2").first()).toBeVisible();
    }
  });

  test("tag page loads", async ({ page }) => {
    await page.goto("/");

    const tagLink = page.locator("a[href^='/tag/']").first();
    if (await tagLink.isVisible()) {
      await Promise.all([
        page.waitForURL(/\/tag\//, { timeout: 10_000 }),
        tagLink.click(),
      ]);
      await expect(page.locator("h1, h2").first()).toBeVisible();
    }
  });

  test("archive page loads with year heading", async ({ page }) => {
    const year = new Date().getFullYear();
    await page.goto(`/archive/${year}`);
    const heading = page.locator("header h1").first();
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();
    expect(headingText).toContain(String(year));
  });

  test("archive page shows post count", async ({ page }) => {
    const year = new Date().getFullYear();
    await page.goto(`/archive/${year}`, { waitUntil: "networkidle" });

    const postCount = page.getByText(/篇文章/);
    await expect(postCount).toBeVisible();
  });
});
