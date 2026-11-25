/**
 * L4 Smoke: Public blog reading — home page, post detail, archive, 404, and SEO/JSON-LD.
 */
import { test, expect, gotoFirstPost, seedPostIdempotent } from "./fixtures";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:27028";
const SLUG = `e2e-reading-smoke-${Date.now()}`;
const NOW_EPOCH = Math.floor(Date.now() / 1000);

test.describe("Blog reading smoke", () => {
  test.beforeAll(async () => {
    await seedPostIdempotent(BASE, {
      title: "E2E Reading Smoke Post",
      slug: SLUG,
      content: "# Reading Smoke\n\nPublic post body for L4 smoke verification.",
      status: "published",
      published_at: NOW_EPOCH,
    });
  });

  test("Home page renders non-empty title and post cards with links", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    const article = page.getByRole("article").first();
    await expect(article).toBeVisible();
    const href = await article.getByRole("link").first().getAttribute("href");
    expect(href).toMatch(/\/\d{4}\/\d{2}\//);
    await expect(article.locator("time")).toBeVisible();
  });

  test("Clicking a post card navigates to post detail with title, date, and body", async ({
    page,
  }) => {
    const url = await gotoFirstPost(page);
    expect(url).toMatch(/\/\d{4}\/\d{2}\//);

    const h1 = page.getByRole("heading", { level: 1 }).first();
    await expect(h1).toBeVisible();
    expect(((await h1.textContent()) ?? "").trim().length).toBeGreaterThan(0);

    const time = page.locator("time").first();
    await expect(time).toBeVisible();
    expect(await time.getAttribute("datetime")).toMatch(/\d{4}-\d{2}-\d{2}/);
    await expect(page.locator(".article-body, article").first()).toBeVisible();
  });

  test("Post detail embeds BlogPosting/Article and BreadcrumbList JSON-LD and article meta", async ({
    page,
  }) => {
    const url = await gotoFirstPost(page);
    expect(url).toMatch(/\/\d{4}\/\d{2}\//);
    await expect(page).toHaveTitle(/.+/);

    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /.+/);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/\d{4}\/\d{2}\//);

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const parsed = blocks
      .map((b) => {
        try {
          return JSON.parse(b) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((d): d is Record<string, unknown> => d !== null);
    expect(parsed.some((d) => d["@type"] === "BlogPosting" || d["@type"] === "Article")).toBe(true);
    expect(parsed.some((d) => d["@type"] === "BreadcrumbList")).toBe(true);
  });

  test("Archive year page renders year heading and post count", async ({ page }) => {
    const year = new Date().getFullYear();
    await page.goto(`/archive/${year}`, { waitUntil: "networkidle" });
    const heading = page.locator("header h1").first();
    await expect(heading).toBeVisible();
    expect(await heading.textContent()).toContain(String(year));
    await expect(page.getByText(/篇文章/)).toBeVisible();
  });

  test("Non-existent post slug returns 404", async ({ page }) => {
    const response = await page.goto("/2099/01/non-existent-slug-12345", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(404);
  });
});
