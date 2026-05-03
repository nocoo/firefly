import { test, expect } from "@playwright/test";

test.describe("RSS feed", () => {
  test("/feed.xml returns valid RSS", async ({ page }) => {
    const response = await page.goto("/feed.xml");
    expect(response?.status()).toBe(200);

    const contentType = response?.headers()["content-type"] ?? "";
    expect(contentType).toMatch(/xml|rss/);

    const body = await response!.text();
    expect(body).toMatch(/<rss|<feed|<channel/);
  });

  test("/feed.xml contains channel metadata", async ({ page }) => {
    const response = await page.goto("/feed.xml");
    const body = await response!.text();

    expect(body).toMatch(/<title>/);
    expect(body).toMatch(/<link>/);
    expect(body).toMatch(/<description>/);
  });

  test("feed items have required elements", async ({ page }) => {
    const response = await page.goto("/feed.xml");
    const body = await response!.text();

    if (!body.includes("<item>")) return;

    expect(body).toMatch(/<item>[\s\S]*<title>[\s\S]*<\/title>[\s\S]*<\/item>/);
    expect(body).toMatch(/<item>[\s\S]*<link>[\s\S]*<\/link>[\s\S]*<\/item>/);
    expect(body).toMatch(/<item>[\s\S]*<pubDate>[\s\S]*<\/pubDate>[\s\S]*<\/item>/);
  });

  test("feed item links use correct post URL format", async ({ page }) => {
    const response = await page.goto("/feed.xml");
    const body = await response!.text();

    const linkMatches = body.match(/<item>[\s\S]*?<link>(.*?)<\/link>/g);
    if (!linkMatches || linkMatches.length === 0) return;

    for (const match of linkMatches) {
      const url = match.match(/<link>(.*?)<\/link>/)?.[1] ?? "";
      expect(url).toMatch(/\/\d{4}\/\d{2}\//);
    }
  });
});
