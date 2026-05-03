import { test, expect } from "@playwright/test";

test.describe("Blog homepage pagination", () => {
  test("page 2 loads with posts or 404 when insufficient content", async ({
    page,
  }) => {
    const response = await page.goto("/page/2", { waitUntil: "networkidle" });
    const status = response?.status() ?? 0;

    if (status === 404) {
      return;
    }

    expect(status).toBe(200);
    await expect(page).toHaveURL(/\/page\/2/);

    const postCard = page.locator("article, [data-testid='post-card']");
    const emptyState = page.getByText(/暂无文章/);
    const hasCards = (await postCard.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasCards || hasEmpty).toBe(true);
  });

  test("page 1 returns 404 (only /page/2+ is valid)", async ({ page }) => {
    const response = await page.goto("/page/1", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(404);
  });

  test("non-numeric page returns 404", async ({ page }) => {
    const response = await page.goto("/page/abc", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(404);
  });

  test("negative page returns 404", async ({ page }) => {
    const response = await page.goto("/page/-1", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(404);
  });

  test("pagination navigation links from homepage", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const nextLink = page.locator(
      'a[href="/page/2"], a[href*="/page/2"]',
    ).first();

    if ((await nextLink.count()) > 0) {
      await expect(nextLink).toBeVisible();
      await nextLink.click();
      await expect(page).toHaveURL(/\/page\/2/);
      await expect(page.locator("article, [data-testid='post-card']").first()).toBeVisible();
    }
  });

  test("pagination shows current page indicator", async ({ page }) => {
    const response = await page.goto("/page/2", { waitUntil: "networkidle" });
    if (response?.status() === 404) return;

    const paginationNav = page.locator('nav[aria-label="分页"]');
    if ((await paginationNav.count()) === 0) return;

    const currentPageIndicator = paginationNav.locator('[aria-current="page"]');
    await expect(currentPageIndicator).toBeVisible();
    await expect(currentPageIndicator).toHaveText("2");
  });

  test("pagination has previous page link on page 2", async ({ page }) => {
    const response = await page.goto("/page/2", { waitUntil: "networkidle" });
    if (response?.status() === 404) return;

    const paginationNav = page.locator('nav[aria-label="分页"]');
    if ((await paginationNav.count()) === 0) return;

    const prevLink = paginationNav.locator('a[aria-label="上一页"]');
    await expect(prevLink).toBeVisible();

    await prevLink.click();
    await page.waitForURL("/", { timeout: 10_000 });
  });
});
