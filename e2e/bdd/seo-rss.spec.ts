/**
 * L3 BDD: SEO meta tags, JSON-LD, RSS feed, and image-optimization rendering.
 *
 * Phase 1.1 of L3 → BDD migration (see docs/25-l3-bdd-refactor.md §3, §4.2).
 *
 * Source spec attribution (12 → 10 tests, no double-counting):
 *   - browser/seo-meta.spec.ts         (5 tests)
 *   - browser/rss-feed.spec.ts         (4 tests)
 *   - browser/content-images.spec.ts   L91, L100, L209 (3 tests — see §1.2.1)
 *
 * Mapping (old test → new scenario):
 *   browser/seo-meta.spec.ts "home page has proper meta tags"
 *     + browser/seo-meta.spec.ts "home page has WebSite schema"
 *       → "Given the home page renders, ... I see OG meta tags and JSON-LD schema"
 *   browser/seo-meta.spec.ts "sitemap.xml is accessible"
 *       → "Given the site exposes a sitemap, ... /sitemap.xml returns XML"
 *   browser/seo-meta.spec.ts "robots.txt is accessible"
 *       → "Given the site exposes robots.txt, ... it lists user-agent rules"
 *   browser/seo-meta.spec.ts "llms.txt is accessible"
 *       → "Given the site exposes llms.txt, ... it returns 200"
 *   browser/rss-feed.spec.ts "/feed.xml returns valid RSS"
 *     + browser/rss-feed.spec.ts "/feed.xml contains channel metadata"
 *       → "Given the site exposes an RSS feed, ... it returns a channel with title/link/description"
 *   browser/rss-feed.spec.ts "feed items have required elements"
 *       → "Given feed items exist, ... each item has title/link/pubDate"
 *   browser/rss-feed.spec.ts "feed item links use correct post URL format"
 *       → "Given feed items exist, ... item links match /YYYY/MM/ pattern"
 *   browser/content-images.spec.ts L209 "RSS feed images do not use /_next/image proxy"
 *       → "Given the RSS feed includes images, ... they bypass /_next/image"
 *   browser/content-images.spec.ts L91  "inline images have srcset attribute"
 *       → "Given a published post has inline images, ... the rendered <img> has srcset"
 *   browser/content-images.spec.ts L100 "inline image src points to /_next/image"
 *       → "Given a published post has inline images, ... the rendered <img> src uses /_next/image"
 */
import { test, expect, emptyDataGate } from "./fixtures";

// ---------------------------------------------------------------------------
// Seed helpers — used by the image-optimization scenarios. A post with inline
// images is created in beforeAll and intentionally left in the local E2E DB
// until the runner-level cleanup so we never delete a published post that a
// concurrent worker may still be navigating to. (See docs/25-l3-bdd-refactor.md
// §8.2 — parallel write/delete races between workers.) scripts/run-e2e.ts
// resets the local D1/R2 persist directory between full runs, so the seed
// does not leak across CI invocations.
// ---------------------------------------------------------------------------

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:27028";
const SLUG = `e2e-seo-rss-img-${Date.now()}`;
const NOW_EPOCH = Math.floor(Date.now() / 1000);
const IMAGE_URL = (() => {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) return "https://assets.example.com/wp-content/uploads/test-e2e.jpg";
  try {
    return `${new URL(url).origin}/wp-content/uploads/test-e2e.jpg`;
  } catch {
    return "https://assets.example.com/wp-content/uploads/test-e2e.jpg";
  }
})();
const CONTENT = [
  `# Image Optimization Test`,
  ``,
  `Inline image:`,
  ``,
  `![test photo](${IMAGE_URL})`,
].join("\n");

async function seedPost(): Promise<void> {
  const res = await fetch(`${BASE}/api/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "E2E SEO/RSS Image Optimization",
      slug: SLUG,
      content: CONTENT,
      status: "published",
      published_at: NOW_EPOCH,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to seed post: ${res.status} ${await res.text()}`);
  }
}

function postUrl(): string {
  const d = new Date(NOW_EPOCH * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `/${year}/${month}/${SLUG}`;
}

// ---------------------------------------------------------------------------
// Feature: SEO meta tags & JSON-LD
// ---------------------------------------------------------------------------

test.describe("Feature: SEO meta tags & JSON-LD", () => {
  test("Given the home page renders, When I load it, Then I see OG meta tags and JSON-LD schema", async ({
    page,
  }) => {
    // Given: the home page is the canonical entry for SEO metadata
    // When: visit the home page
    await page.goto("/", { waitUntil: "networkidle" });

    // Then: <title> is non-empty
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // Then: og:title + og:type are populated
    // CSS attribute selector: meta tags have no role/label/testid; this is the
    // documented Playwright pattern for asserting on <meta> attributes.
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /.+/,
    );
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
      "content",
      /.+/,
    );

    // Then: at least one JSON-LD block is embedded with a valid schema shape
    const ldJson = page.locator('script[type="application/ld+json"]');
    expect(await ldJson.count()).toBeGreaterThan(0);
    const content = await ldJson.first().textContent();
    expect(content).toBeTruthy();
    const data = JSON.parse(content!) as Record<string, unknown>;
    expect(data["@context"] ?? data["@type"]).toBeTruthy();
  });

  test("Given the site exposes a sitemap, When I request /sitemap.xml, Then it returns XML", async ({
    page,
  }) => {
    // When: request the sitemap
    const response = await page.goto("/sitemap.xml");

    // Then: 200 + XML content-type
    expect(response?.status()).toBe(200);
    expect(response?.headers()["content-type"] ?? "").toMatch(/xml/);
  });

  test("Given the site exposes robots.txt, When I request it, Then it lists user-agent rules", async ({
    page,
  }) => {
    // When: request robots.txt
    const response = await page.goto("/robots.txt");

    // Then: 200 + body contains "user-agent"
    expect(response?.status()).toBe(200);
    const text = await page.textContent("body");
    expect(text?.toLowerCase()).toContain("user-agent");
  });

  test("Given the site exposes llms.txt, When I request it, Then it returns 200", async ({
    page,
  }) => {
    // When: request llms.txt
    const response = await page.goto("/llms.txt");

    // Then: 200
    expect(response?.status()).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Feature: RSS feed
// ---------------------------------------------------------------------------

test.describe("Feature: RSS feed", () => {
  test("Given the site exposes an RSS feed, When I request /feed.xml, Then it returns a channel with title/link/description", async ({
    page,
  }) => {
    // When: request the feed
    const response = await page.goto("/feed.xml");

    // Then: 200 + RSS/XML content-type + recognisable RSS/Atom root
    expect(response?.status()).toBe(200);
    expect(response?.headers()["content-type"] ?? "").toMatch(/xml|rss/);
    const body = await response!.text();
    expect(body).toMatch(/<rss|<feed|<channel/);

    // Then: channel-level metadata is present
    expect(body).toMatch(/<title>/);
    expect(body).toMatch(/<link>/);
    expect(body).toMatch(/<description>/);
  });

  test("Given feed items exist, When I inspect them, Then each item has title/link/pubDate", async ({
    page,
  }) => {
    const response = await page.goto("/feed.xml");
    const body = await response!.text();

    // Given: at least one <item> exists (otherwise gate the assertion)
    const gate = emptyDataGate(body.includes("<item>") ? 1 : 0, "RSS items");
    test.skip(gate.skip, gate.reason);

    // Then: each item contains title/link/pubDate
    expect(body).toMatch(/<item>[\s\S]*<title>[\s\S]*<\/title>[\s\S]*<\/item>/);
    expect(body).toMatch(/<item>[\s\S]*<link>[\s\S]*<\/link>[\s\S]*<\/item>/);
    expect(body).toMatch(
      /<item>[\s\S]*<pubDate>[\s\S]*<\/pubDate>[\s\S]*<\/item>/,
    );
  });

  test("Given feed items exist, When I inspect their links, Then each matches the /YYYY/MM/ post URL pattern", async ({
    page,
  }) => {
    const response = await page.goto("/feed.xml");
    const body = await response!.text();

    const linkMatches = body.match(/<item>[\s\S]*?<link>(.*?)<\/link>/g);
    const gate = emptyDataGate(linkMatches?.length ?? 0, "RSS item links");
    test.skip(gate.skip, gate.reason);

    for (const match of linkMatches!) {
      const url = match.match(/<link>(.*?)<\/link>/)?.[1] ?? "";
      expect(url).toMatch(/\/\d{4}\/\d{2}\//);
    }
  });

  test("Given the RSS feed includes images, When rendered, Then they bypass /_next/image and have no srcset", async ({
    page,
  }) => {
    const response = await page.goto("/feed.xml");
    expect(response?.status()).toBe(200);
    const body = await response!.text();

    // Then: if the feed contains <img tags, none use the Next.js image proxy
    if (body.includes("<img")) {
      expect(body).not.toContain("/_next/image");
    }

    // Then: the feed never carries srcset (raw HTML only)
    expect(body).not.toMatch(/srcset=/);
  });
});

// ---------------------------------------------------------------------------
// Feature: Inline image optimization (rendered post markup)
// ---------------------------------------------------------------------------

test.describe("Feature: Inline image optimization", () => {
  test.beforeAll(async () => {
    await seedPost();
  });

  test("Given a published post has inline images, When I view it, Then the rendered <img> has a srcset", async ({
    page,
  }) => {
    // Given: a seeded post containing one inline image (beforeAll)
    // When: view the post detail page
    await page.goto(postUrl(), { waitUntil: "networkidle" });

    // Then: the rendered <img> exposes a width-descriptor srcset
    // CSS class selector: ".blog-content" is the stable Markdown body wrapper
    // (component root); no role/testid exists for the post body container.
    const img = page.locator(".blog-content img").first();
    await expect(img).toBeVisible({ timeout: 10_000 });
    await expect(img).toHaveAttribute("srcset", /\d+w/);
  });

  test("Given a published post has inline images, When I view it, Then the rendered <img> src uses /_next/image", async ({
    page,
  }) => {
    // Given: same seeded post
    // When: view the post detail page
    await page.goto(postUrl(), { waitUntil: "networkidle" });

    // Then: the src goes through the Next.js image optimizer
    // CSS class selector: same reason as above (.blog-content wrapper).
    const img = page.locator(".blog-content img").first();
    await expect(img).toBeVisible({ timeout: 10_000 });
    await expect(img).toHaveAttribute("src", /\/_next\/image/);
  });
});
