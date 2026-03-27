import { test, expect } from "@playwright/test";

test.describe("RSS feed", () => {
  test("/feed.xml returns valid RSS", async ({ page }) => {
    const response = await page.goto("/feed.xml");
    expect(response?.status()).toBe(200);

    const contentType = response?.headers()["content-type"] ?? "";
    expect(contentType).toMatch(/xml|rss/);

    // Use response body (raw text) instead of page.content() which HTML-wraps XML
    const body = await response!.text();
    // RSS feed should contain standard RSS/Atom elements
    expect(body).toMatch(/<rss|<feed|<channel/);
  });

  test("/feed.xml contains channel metadata", async ({ page }) => {
    const response = await page.goto("/feed.xml");
    const body = await response!.text();

    // Channel/feed should always have a title, even with zero entries
    expect(body).toMatch(/<title>/);
  });
});
