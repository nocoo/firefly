/**
 * L4 Smoke: SEO endpoints (/sitemap.xml, /robots.txt, /feed.xml) and inline image optimization.
 */
import { test, expect, seedPostIdempotent } from "./fixtures";
import { e2eBddTestImageUrl } from "../../src/lib/e2e-bdd-image";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:27028";
const SLUG = `e2e-seo-rss-img-${Date.now()}`;
const NOW_EPOCH = Math.floor(Date.now() / 1000);
const IMAGE_URL = e2eBddTestImageUrl(process.env.R2_PUBLIC_URL);

function postUrl(): string {
  const d = new Date(NOW_EPOCH * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `/${year}/${month}/${SLUG}`;
}

test.describe("SEO, RSS & image optimization smoke", () => {
  test.beforeAll(async () => {
    await seedPostIdempotent(BASE, {
      title: "E2E SEO/RSS Image Optimization",
      slug: SLUG,
      content: `# Image Optimization Test\n\n![test photo](${IMAGE_URL})`,
      status: "published",
      published_at: NOW_EPOCH,
    });
  });

  test("Home page exposes OG meta tags and JSON-LD schema", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    expect((await page.title()).length).toBeGreaterThan(0);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /.+/);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", /.+/);
    const ldJson = page.locator('script[type="application/ld+json"]');
    expect(await ldJson.count()).toBeGreaterThan(0);
  });

  test("/sitemap.xml and /robots.txt return expected content", async ({ page }) => {
    const sitemap = await page.goto("/sitemap.xml");
    expect(sitemap?.status()).toBe(200);
    expect(sitemap?.headers()["content-type"] ?? "").toMatch(/xml/);

    const robots = await page.goto("/robots.txt");
    expect(robots?.status()).toBe(200);
    expect((await page.textContent("body"))?.toLowerCase()).toContain("user-agent");
  });

  test("/feed.xml returns valid RSS with items and bypasses /_next/image", async ({ page }) => {
    const response = await page.goto("/feed.xml");
    expect(response?.status()).toBe(200);
    expect(response?.headers()["content-type"] ?? "").toMatch(/xml|rss/);
    const body = await response!.text();
    expect(body).toMatch(/<rss|<feed|<channel/);
    expect(body).toMatch(/<item>[\s\S]*<title>[\s\S]*<\/title>[\s\S]*<\/item>/);
    expect(body).not.toContain("/_next/image");
    expect(body).not.toMatch(/srcset=/);
  });

  test("Published post inline image uses /_next/image and srcset", async ({ page }) => {
    await page.goto(postUrl(), { waitUntil: "networkidle" });
    const img = page.locator(".blog-content img").first();
    await expect(img).toBeVisible({ timeout: 10_000 });
    await expect(img).toHaveAttribute("srcset", /\d+w/);
    await expect(img).toHaveAttribute("src", /\/_next\/image/);
  });
});
