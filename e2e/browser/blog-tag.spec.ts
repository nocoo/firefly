import { test, expect } from "@playwright/test";

test.describe("Blog tag page", () => {
  test("tag page loads with heading and post count", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const tagLink = page.locator("a[href^='/tag/']").first();
    if ((await tagLink.count()) === 0) return;

    const href = await tagLink.getAttribute("href");
    await page.goto(href!, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/tag\//);

    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();
    expect(headingText).toMatch(/^#/);

    const postCount = page.getByText(/篇文章/);
    await expect(postCount).toBeVisible();
  });

  test("tag page shows post cards or empty state", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const tagLink = page.locator("a[href^='/tag/']").first();
    if ((await tagLink.count()) === 0) return;

    const href = await tagLink.getAttribute("href");
    await page.goto(href!, { waitUntil: "networkidle" });

    const postCard = page.locator("article, [data-testid='post-card']");
    const emptyState = page.getByText(/该标签下暂无文章/);
    const hasCards = (await postCard.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasCards || hasEmpty).toBe(true);
  });

  test("tag page has JSON-LD structured data", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const tagLink = page.locator("a[href^='/tag/']").first();
    if ((await tagLink.count()) === 0) return;

    const href = await tagLink.getAttribute("href");
    await page.goto(href!, { waitUntil: "networkidle" });

    const ldJson = page.locator('script[type="application/ld+json"]');
    const count = await ldJson.count();
    expect(count).toBeGreaterThan(0);

    const content = await ldJson.first().textContent();
    expect(content).toBeTruthy();
    const data = JSON.parse(content!);
    expect(data["@context"] || data["@type"]).toBeTruthy();
  });

  test("tag page has proper meta tags", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const tagLink = page.locator("a[href^='/tag/']").first();
    if ((await tagLink.count()) === 0) return;

    const href = await tagLink.getAttribute("href");
    await page.goto(href!, { waitUntil: "networkidle" });

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title).toMatch(/#/);
  });

  test("clicking a post card navigates to the post detail page", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const tagLink = page.locator("a[href^='/tag/']").first();
    if ((await tagLink.count()) === 0) return;

    const href = await tagLink.getAttribute("href");
    await page.goto(href!, { waitUntil: "networkidle" });

    const postLink = page.locator("article h2 a").first();
    if ((await postLink.count()) === 0) return;

    const postHref = await postLink.getAttribute("href");
    expect(postHref).toMatch(/\/\d{4}\/\d{2}\//);

    await postLink.click();
    await page.waitForURL(/\/\d{4}\/\d{2}\//, { timeout: 10_000 });
    await expect(page.locator("h1")).toBeVisible();
  });

  test("thin-content tag has noindex robots directive", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const tagLink = page.locator("a[href^='/tag/']").first();
    if ((await tagLink.count()) === 0) return;

    const href = await tagLink.getAttribute("href");
    await page.goto(href!, { waitUntil: "networkidle" });

    const robots = page.locator('meta[name="robots"]');
    const postCountText = await page.getByText(/篇文章/).textContent();
    const count = parseInt(postCountText ?? "0", 10);

    if (count < 3) {
      await expect(robots).toHaveAttribute("content", /noindex/);
    } else {
      const robotsCount = await robots.count();
      if (robotsCount > 0) {
        const content = await robots.getAttribute("content");
        expect(content).not.toMatch(/noindex/);
      }
    }
  });

  test("non-existent tag returns 404", async ({ page }) => {
    const response = await page.goto("/tag/non-existent-slug-12345", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(404);
  });
});
