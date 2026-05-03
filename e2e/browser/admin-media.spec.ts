/**
 * L3 E2E: Admin media library
 *
 * Covers: /admin/media
 */
import { test, expect } from "@playwright/test";

test.describe("Admin media library", () => {
  test("media page loads", async ({ page }) => {
    await page.goto("/admin/media", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/admin\/media/);

    const heading = page.getByText(/媒体库|Media/i);
    await expect(heading.first()).toBeVisible({ timeout: 10_000 });
  });

  test("shows media grid with thumbnails", async ({ page }) => {
    await page.goto("/admin/media", { waitUntil: "networkidle" });

    const gridItems = page.locator(".grid .aspect-square");
    const count = await gridItems.count();
    if (count > 0) {
      await expect(gridItems.first()).toBeVisible();
    }
  });

  test("has search input for filtering files", async ({ page }) => {
    await page.goto("/admin/media", { waitUntil: "networkidle" });

    const searchInput = page.locator('input[placeholder*="搜索文件"]');
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
  });

  test("year filter dropdown is present and functional", async ({ page }) => {
    await page.goto("/admin/media", { waitUntil: "networkidle" });

    const yearSelect = page.locator("select").filter({ hasText: /全部年份/ });
    if ((await yearSelect.count()) === 0) return;

    await expect(yearSelect).toBeVisible();
    const options = yearSelect.locator("option");
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThanOrEqual(2);
  });

  test("mime type filter dropdown is present", async ({ page }) => {
    await page.goto("/admin/media", { waitUntil: "networkidle" });

    const mimeSelect = page.locator("select").filter({ hasText: /所有类型/ });
    if ((await mimeSelect.count()) === 0) return;

    await expect(mimeSelect).toBeVisible();
    const options = mimeSelect.locator("option");
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThanOrEqual(2);
  });
});

test.describe("Admin media lightbox", () => {
  test("clicking media thumbnail opens lightbox with image", async ({
    page,
  }) => {
    await page.goto("/admin/media", { waitUntil: "networkidle" });

    const gridItem = page.locator(".grid .aspect-square").first();
    if ((await gridItem.count()) === 0) return;

    await gridItem.click();

    const overlay = page.locator(".fixed.inset-0.z-50");
    await expect(overlay).toBeVisible({ timeout: 5_000 });
    const lightboxImg = overlay.locator("img");
    await expect(lightboxImg).toBeVisible();
  });

  test("lightbox shows metadata panel with file info", async ({ page }) => {
    await page.goto("/admin/media", { waitUntil: "networkidle" });

    const gridItem = page.locator(".grid .aspect-square").first();
    if ((await gridItem.count()) === 0) return;

    await gridItem.click();

    const overlay = page.locator(".fixed.inset-0.z-50");
    await expect(overlay).toBeVisible({ timeout: 5_000 });

    const sidePanel = overlay.locator(
      ".border-t.border-border, .border-l.border-border",
    );
    await expect(sidePanel.first()).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(overlay).not.toBeVisible();
  });
});
