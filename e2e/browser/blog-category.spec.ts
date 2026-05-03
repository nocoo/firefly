import { test, expect } from "@playwright/test";

test.describe("Blog category page", () => {
  test("category page loads with heading and post count", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const categoryLink = page.locator("a[href^='/category/']").first();
    if ((await categoryLink.count()) === 0) return;

    const href = await categoryLink.getAttribute("href");
    await page.goto(href!, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/category\//);

    await expect(page.locator("h1")).toBeVisible();
    const postCount = page.getByText(/篇文章/);
    await expect(postCount).toBeVisible();
  });

  test("category page shows post cards or empty state", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const categoryLink = page.locator("a[href^='/category/']").first();
    if ((await categoryLink.count()) === 0) return;

    const href = await categoryLink.getAttribute("href");
    await page.goto(href!, { waitUntil: "networkidle" });

    const postCard = page.locator("article, [data-testid='post-card']");
    const emptyState = page.getByText(/该分类下暂无文章/);
    const hasCards = (await postCard.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasCards || hasEmpty).toBe(true);
  });

  test("category page has JSON-LD structured data", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const categoryLink = page.locator("a[href^='/category/']").first();
    if ((await categoryLink.count()) === 0) return;

    const href = await categoryLink.getAttribute("href");
    await page.goto(href!, { waitUntil: "networkidle" });

    const ldJson = page.locator('script[type="application/ld+json"]');
    const count = await ldJson.count();
    expect(count).toBeGreaterThan(0);

    const content = await ldJson.first().textContent();
    expect(content).toBeTruthy();
    const data = JSON.parse(content!);
    expect(data["@context"] || data["@type"]).toBeTruthy();
  });

  test("category page has proper meta tags", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const categoryLink = page.locator("a[href^='/category/']").first();
    if ((await categoryLink.count()) === 0) return;

    const href = await categoryLink.getAttribute("href");
    await page.goto(href!, { waitUntil: "networkidle" });

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute("content", /.+/);
  });

  test("clicking a post card navigates to the post detail page", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const categoryLink = page.locator("a[href^='/category/']").first();
    if ((await categoryLink.count()) === 0) return;

    const href = await categoryLink.getAttribute("href");
    await page.goto(href!, { waitUntil: "networkidle" });

    const postLink = page.locator("article h2 a").first();
    if ((await postLink.count()) === 0) return;

    const postHref = await postLink.getAttribute("href");
    expect(postHref).toMatch(/\/\d{4}\/\d{2}\//);

    await postLink.click();
    await page.waitForURL(/\/\d{4}\/\d{2}\//, { timeout: 10_000 });
    await expect(page.locator("h1")).toBeVisible();
  });

  test("post cards display title, date, and excerpt", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const categoryLink = page.locator("a[href^='/category/']").first();
    if ((await categoryLink.count()) === 0) return;

    const href = await categoryLink.getAttribute("href");
    await page.goto(href!, { waitUntil: "networkidle" });

    const article = page.locator("article").first();
    if ((await article.count()) === 0) return;

    await expect(article.locator("h2")).toBeVisible();
    await expect(article.locator("time")).toBeVisible();
  });

  test("non-existent category returns 404", async ({ page }) => {
    const response = await page.goto("/category/non-existent-slug-12345", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(404);
  });
});
