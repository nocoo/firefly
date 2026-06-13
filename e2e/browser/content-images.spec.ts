/**
 * L3 Browser E2E — Admin media library lightbox.
 *
 * The reader-side image lightbox and linked-image scenarios were migrated to
 * e2e/bdd/blog-content.spec.ts (Phase 1.4, see docs/25-l3-bdd-refactor.md
 * §1.2.1). Inline image srcset + /_next/image src migrated earlier to
 * e2e/bdd/seo-rss.spec.ts (Phase 1.1).
 *
 * What remains here is the admin media library lightbox + metadata panel,
 * which will be migrated in Phase 3.2.
 */
import { test, expect } from "@playwright/test";

test.describe("Admin media library lightbox", () => {
  test("media library page loads", async ({ page }) => {
    await page.goto("/admin/media", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/admin\/media/);
  });

  test("clicking a media thumbnail opens lightbox with metadata", async ({
    page,
  }) => {
    await page.goto("/admin/media", { waitUntil: "networkidle" });

    // Wait for the grid to appear — may be empty
    const gridItem = page
      .locator(".grid .aspect-square, [class*='grid'] .aspect-square")
      .first();

    if ((await gridItem.count()) === 0) {
      // No media items — skip gracefully
      return;
    }

    await expect(gridItem).toBeVisible({ timeout: 10_000 });
    await gridItem.click();

    // Lightbox overlay should appear
    const overlay = page.locator(".fixed.inset-0.z-50");
    await expect(overlay).toBeVisible({ timeout: 5_000 });

    // It should have the metadata side panel (children slot)
    // The side panel contains file info icons and action buttons
    const sidePanel = overlay.locator(
      ".border-t.border-border, .border-l.border-border",
    );
    await expect(sidePanel.first()).toBeVisible();

    // Close with Escape
    await page.keyboard.press("Escape");
    await expect(overlay).not.toBeVisible();
  });
});
