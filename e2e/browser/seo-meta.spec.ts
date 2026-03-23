import { test, expect } from "@playwright/test";

test.describe("SEO meta tags", () => {
  test("home page has proper meta tags", async ({ page }) => {
    await page.goto("/");

    // Title
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);

    // Description
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute("content", /.+/);

    // Open Graph
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute("content", /.+/);

    const ogType = page.locator('meta[property="og:type"]');
    await expect(ogType).toHaveAttribute("content", /.+/);
  });

  test("sitemap.xml is accessible", async ({ page }) => {
    const response = await page.goto("/sitemap.xml");
    expect(response?.status()).toBe(200);

    const contentType = response?.headers()["content-type"] ?? "";
    expect(contentType).toMatch(/xml/);
  });

  test("robots.txt is accessible", async ({ page }) => {
    const response = await page.goto("/robots.txt");
    expect(response?.status()).toBe(200);

    const text = await page.textContent("body");
    expect(text).toContain("User-agent");
  });

  test("llms.txt is accessible", async ({ page }) => {
    const response = await page.goto("/llms.txt");
    expect(response?.status()).toBe(200);
  });
});

test.describe("JSON-LD structured data", () => {
  test("home page has WebSite schema", async ({ page }) => {
    await page.goto("/");

    const ldJson = page.locator('script[type="application/ld+json"]');
    const count = await ldJson.count();
    expect(count).toBeGreaterThan(0);

    const content = await ldJson.first().textContent();
    expect(content).toBeTruthy();
    const data = JSON.parse(content!);
    // Should contain WebSite or similar schema
    expect(data["@context"] || data["@type"]).toBeTruthy();
  });
});
