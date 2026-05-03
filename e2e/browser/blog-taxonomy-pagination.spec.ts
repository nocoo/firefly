import { test, expect } from "@playwright/test";

test.describe("Category pagination", () => {
  test("category page 2 loads or 404 when insufficient content", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const categoryLink = page.locator("a[href^='/category/']").first();
    if ((await categoryLink.count()) === 0) return;

    const href = await categoryLink.getAttribute("href");
    const slug = href!.replace("/category/", "");
    const response = await page.goto(`/category/${slug}/page/2`, {
      waitUntil: "networkidle",
    });
    const status = response?.status() ?? 0;
    expect([200, 404]).toContain(status);
  });

  test("category page 2 shows category heading when loaded", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const categoryLink = page.locator("a[href^='/category/']").first();
    if ((await categoryLink.count()) === 0) return;

    const href = await categoryLink.getAttribute("href");
    const slug = href!.replace("/category/", "");
    const response = await page.goto(`/category/${slug}/page/2`, {
      waitUntil: "networkidle",
    });
    if (response?.status() === 404) return;

    await expect(page.locator("header h1")).toBeVisible();
  });

  test("category page 1 returns 404", async ({ page }) => {
    const response = await page.goto("/category/anything/page/1", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(404);
  });

  test("non-existent category pagination returns 404", async ({ page }) => {
    const response = await page.goto(
      "/category/non-existent-slug-12345/page/2",
      { waitUntil: "networkidle" },
    );
    expect(response?.status()).toBe(404);
  });
});

test.describe("Tag pagination", () => {
  test("tag page 2 loads or 404 when insufficient content", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const tagLink = page.locator("a[href^='/tag/']").first();
    if ((await tagLink.count()) === 0) return;

    const href = await tagLink.getAttribute("href");
    const slug = href!.replace("/tag/", "");
    const response = await page.goto(`/tag/${slug}/page/2`, {
      waitUntil: "networkidle",
    });
    const status = response?.status() ?? 0;
    expect([200, 404]).toContain(status);
  });

  test("tag page 2 shows tag heading with # prefix when loaded", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const tagLink = page.locator("a[href^='/tag/']").first();
    if ((await tagLink.count()) === 0) return;

    const href = await tagLink.getAttribute("href");
    const slug = href!.replace("/tag/", "");
    const response = await page.goto(`/tag/${slug}/page/2`, {
      waitUntil: "networkidle",
    });
    if (response?.status() === 404) return;

    const heading = page.locator("header h1");
    await expect(heading).toBeVisible();
    const text = await heading.textContent();
    expect(text).toMatch(/^#/);
  });

  test("tag page 1 returns 404", async ({ page }) => {
    const response = await page.goto("/tag/anything/page/1", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(404);
  });

  test("non-existent tag pagination returns 404", async ({ page }) => {
    const response = await page.goto(
      "/tag/non-existent-slug-12345/page/2",
      { waitUntil: "networkidle" },
    );
    expect(response?.status()).toBe(404);
  });
});

test.describe("Archive pagination", () => {
  test("archive page 2 loads or 404 when insufficient content", async ({
    page,
  }) => {
    const year = new Date().getFullYear();
    const response = await page.goto(`/archive/${year}/page/2`, {
      waitUntil: "networkidle",
    });
    const status = response?.status() ?? 0;
    expect([200, 404]).toContain(status);
  });

  test("archive page 2 shows year in heading when loaded", async ({
    page,
  }) => {
    const year = new Date().getFullYear();
    const response = await page.goto(`/archive/${year}/page/2`, {
      waitUntil: "networkidle",
    });
    if (response?.status() === 404) return;

    const heading = page.locator("header h1");
    await expect(heading).toBeVisible();
    const text = await heading.textContent();
    expect(text).toContain(String(year));
  });

  test("archive page 1 returns 404", async ({ page }) => {
    const year = new Date().getFullYear();
    const response = await page.goto(`/archive/${year}/page/1`, {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(404);
  });

  test("non-existent archive period pagination returns 404", async ({
    page,
  }) => {
    const response = await page.goto("/archive/9999/page/2", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(404);
  });
});
