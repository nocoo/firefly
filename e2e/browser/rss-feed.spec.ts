import { test, expect } from "@playwright/test";

test.describe("RSS feed", () => {
  test("/feed.xml returns valid RSS", async ({ page }) => {
    const response = await page.goto("/feed.xml");
    expect(response?.status()).toBe(200);

    const contentType = response?.headers()["content-type"] ?? "";
    expect(contentType).toMatch(/xml/);

    const body = await page.content();
    // RSS feed should contain standard RSS/Atom elements
    expect(body).toMatch(/<rss|<feed|<channel/);
  });

  test("/feed.xml contains blog entries", async ({ page }) => {
    await page.goto("/feed.xml");
    const body = await page.content();

    // Should have at least one item/entry
    expect(body).toMatch(/<item|<entry/);
  });
});
