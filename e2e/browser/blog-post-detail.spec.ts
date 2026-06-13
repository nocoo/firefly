/**
 * L3 E2E: Blog post detail page
 *
 * Covers: /(blog)/[year]/[month]/[slug]/page.tsx
 *
 * Test DB may have zero published posts. Each test discovers a real post by
 * navigating from the home page and skips itself when none is available
 * (mirroring the pattern used in blog-navigation.spec.ts).
 */
import { test, expect, type Page } from "@playwright/test";

/** Navigate from the home page into the first post detail. Returns false when
 *  the test DB has no published post — caller should bail out. */
async function gotoFirstPost(page: Page): Promise<boolean> {
  await page.goto("/", { waitUntil: "networkidle" });
  const postLink = page.locator("article h2 a").first();
  if ((await postLink.count()) === 0) return false;
  await postLink.click();
  await page.waitForURL(/\/\d{4}\/\d{2}\//, { timeout: 10_000 });
  return true;
}

test.describe("Blog post detail page", () => {
  test("post detail loads with title, date, and body content", async ({
    page,
  }) => {
    if (!(await gotoFirstPost(page))) return;

    // Title (h1)
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    const titleText = await h1.textContent();
    expect((titleText ?? "").trim().length).toBeGreaterThan(0);

    // Publish date — rendered inside a <time> element with a valid datetime.
    const time = page.locator("time").first();
    await expect(time).toBeVisible();
    const dateTime = await time.getAttribute("datetime");
    expect(dateTime).toMatch(/\d{4}-\d{2}-\d{2}/);

    // Article body content — the renderer wraps Markdown output in .article-body
    // (rendered via ArticleBody). Fall back to <article> if class is restyled.
    const body = page.locator(".article-body, article").first();
    await expect(body).toBeVisible();
  });

  test("category byline link is clickable when post has a category", async ({
    page,
  }) => {
    if (!(await gotoFirstPost(page))) return;

    // Posts without a category render no category link — skip if absent.
    const categoryLink = page.locator(".blog-byline a[href^='/category/']");
    if ((await categoryLink.count()) === 0) return;

    const href = await categoryLink.first().getAttribute("href");
    expect(href).toMatch(/^\/category\//);

    await categoryLink.first().click();
    await page.waitForURL(/\/category\//, { timeout: 10_000 });
    await expect(page.locator("header h1")).toBeVisible();
  });

  test("tag pills link to their tag pages when present", async ({ page }) => {
    if (!(await gotoFirstPost(page))) return;

    const tagPill = page.locator("a.blog-tag-pill").first();
    if ((await tagPill.count()) === 0) return;

    const href = await tagPill.getAttribute("href");
    expect(href).toMatch(/^\/tag\//);

    await tagPill.click();
    await page.waitForURL(/\/tag\//, { timeout: 10_000 });
    await expect(page.locator("header h1")).toBeVisible();
  });

  test("post detail includes JSON-LD with an Article-family schema", async ({
    page,
  }) => {
    if (!(await gotoFirstPost(page))) return;

    const ldJson = page.locator('script[type="application/ld+json"]');
    const count = await ldJson.count();
    // Post detail emits two blocks: BlogPosting + BreadcrumbList.
    expect(count).toBeGreaterThanOrEqual(1);

    const blocks = await ldJson.allTextContents();
    const parsed = blocks
      .map((b) => {
        try {
          return JSON.parse(b);
        } catch {
          return null;
        }
      })
      .filter((d): d is Record<string, unknown> => d !== null);

    // BlogPosting is part of the Article schema family.
    const articleLike = parsed.find(
      (d) => d["@type"] === "BlogPosting" || d["@type"] === "Article",
    );
    expect(articleLike).toBeTruthy();
  });

  test("post detail emits BreadcrumbList JSON-LD for navigation", async ({
    page,
  }) => {
    if (!(await gotoFirstPost(page))) return;

    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const parsed = blocks
      .map((b) => {
        try {
          return JSON.parse(b);
        } catch {
          return null;
        }
      })
      .filter((d): d is Record<string, unknown> => d !== null);

    const breadcrumb = parsed.find((d) => d["@type"] === "BreadcrumbList");
    expect(breadcrumb).toBeTruthy();
  });

  test("non-existent slug returns 404", async ({ page }) => {
    // Year/month don't need to be plausible — getPostBySlug returning null
    // triggers notFound() before the URL date guard runs.
    const response = await page.goto(
      "/2099/01/non-existent-slug-12345",
      { waitUntil: "networkidle" },
    );
    expect(response?.status()).toBe(404);
  });

  test("post detail has article-typed SEO meta tags and canonical URL", async ({
    page,
  }) => {
    if (!(await gotoFirstPost(page))) return;

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute("content", /.+/);

    const ogType = page.locator('meta[property="og:type"]');
    await expect(ogType).toHaveAttribute("content", "article");

    // Canonical URL is generated by buildPageMeta (alternates.canonical) and
    // surfaces as <link rel="canonical">.
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute("href", /\/\d{4}\/\d{2}\//);
  });
});
