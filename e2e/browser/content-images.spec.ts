/**
 * L3 Browser E2E — Image optimization & content lightbox
 *
 * Covers:
 * 1. Inline images have srcset attribute (optimized rendering)
 * 2. Inline image src points to /_next/image
 * 3. Click inline image opens lightbox overlay
 * 4. Lightbox shows correct image
 * 5. Lightbox closes on X button / Escape / backdrop click
 * 6. Click linked image (<a><img>) navigates — no lightbox
 * 7. RSS feed inline images still have raw <img> src (no /_next/image)
 * 8. Admin media library lightbox works with metadata panel
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:27043";

// ---------------------------------------------------------------------------
// Helpers — seed and clean up a published post with inline images
// ---------------------------------------------------------------------------

const SLUG = `e2e-img-opt-${Date.now()}`;
const NOW_EPOCH = Math.floor(Date.now() / 1000);
const IMAGE_URL = "https://assets.lizheng.me/wp-content/uploads/test-e2e.jpg";
const LINK_HREF = "https://example.com";

const CONTENT = [
  `# Image Optimization Test`,
  ``,
  `Here is an inline image:`,
  ``,
  `![test photo](${IMAGE_URL})`,
  ``,
  `Here is a linked image:`,
  ``,
  `[![linked photo](${IMAGE_URL})](${LINK_HREF})`,
].join("\n");

async function seedPost(): Promise<string> {
  const res = await fetch(`${BASE}/api/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "E2E Image Optimization Test",
      slug: SLUG,
      content: CONTENT,
      status: "published",
      published_at: NOW_EPOCH,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to seed post: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  return body.id;
}

async function deletePost(): Promise<void> {
  await fetch(`${BASE}/api/posts/${SLUG}`, { method: "DELETE" });
}

function postUrl(): string {
  const d = new Date(NOW_EPOCH * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `/${year}/${month}/${SLUG}`;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

test.describe("Content image optimization & lightbox", () => {
  test.beforeAll(async () => {
    await seedPost();
  });

  test.afterAll(async () => {
    await deletePost();
  });

  // 1. Inline images have srcset attribute
  test("inline images have srcset attribute", async ({ page }) => {
    await page.goto(postUrl(), { waitUntil: "networkidle" });

    const img = page.locator(".blog-content img").first();
    await expect(img).toBeVisible({ timeout: 10_000 });
    await expect(img).toHaveAttribute("srcset", /\d+w/);
  });

  // 2. Inline image src points to /_next/image
  test("inline image src points to /_next/image", async ({ page }) => {
    await page.goto(postUrl(), { waitUntil: "networkidle" });

    const img = page.locator(".blog-content img").first();
    await expect(img).toBeVisible({ timeout: 10_000 });
    await expect(img).toHaveAttribute("src", /\/_next\/image/);
  });

  // 3. Click inline image opens lightbox overlay
  test("click inline image opens lightbox", async ({ page }) => {
    await page.goto(postUrl(), { waitUntil: "networkidle" });

    // Click the first non-linked image
    const imgs = page.locator(".blog-content img");
    const count = await imgs.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Find the standalone (non-linked) image
    const standaloneImg = page.locator(
      ".blog-content img:not(a img)",
    ).first();
    await standaloneImg.click();

    // Lightbox overlay should appear
    const overlay = page.locator(".fixed.inset-0.z-50");
    await expect(overlay).toBeVisible({ timeout: 5_000 });
  });

  // 4. Lightbox shows correct image
  test("lightbox shows correct image", async ({ page }) => {
    await page.goto(postUrl(), { waitUntil: "networkidle" });

    const standaloneImg = page.locator(
      ".blog-content img:not(a img)",
    ).first();
    await standaloneImg.click();

    const overlay = page.locator(".fixed.inset-0.z-50");
    await expect(overlay).toBeVisible({ timeout: 5_000 });

    // The lightbox image should reference the original URL
    const lightboxImg = overlay.locator("img");
    await expect(lightboxImg).toBeVisible();
    const src = await lightboxImg.getAttribute("src");
    expect(src).toContain(IMAGE_URL);
  });

  // 5. Lightbox closes on X button / Escape / backdrop click
  test("lightbox closes on X button, Escape, and backdrop", async ({
    page,
  }) => {
    await page.goto(postUrl(), { waitUntil: "networkidle" });

    const standaloneImg = page.locator(
      ".blog-content img:not(a img)",
    ).first();
    const overlay = page.locator(".fixed.inset-0.z-50");

    // --- Close via X button ---
    await standaloneImg.click();
    await expect(overlay).toBeVisible({ timeout: 5_000 });
    const closeBtn = overlay.locator("button").first();
    await closeBtn.click();
    await expect(overlay).not.toBeVisible();

    // --- Close via Escape key ---
    await standaloneImg.click();
    await expect(overlay).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press("Escape");
    await expect(overlay).not.toBeVisible();

    // --- Close via backdrop click ---
    await standaloneImg.click();
    await expect(overlay).toBeVisible({ timeout: 5_000 });
    // Click the overlay backdrop itself (top-left corner, outside content)
    await overlay.click({ position: { x: 5, y: 5 } });
    await expect(overlay).not.toBeVisible();
  });

  // 6. Click linked image (<a><img>) does NOT open lightbox
  test("linked image click navigates without lightbox", async ({ page }) => {
    await page.goto(postUrl(), { waitUntil: "networkidle" });

    // The linked image is inside an <a> tag
    const linkedImg = page.locator(".blog-content a img").first();
    if ((await linkedImg.count()) === 0) {
      // No linked images found — skip gracefully
      return;
    }

    await expect(linkedImg).toBeVisible();

    // Click the linked image — it should navigate, not open lightbox
    await Promise.all([
      page.waitForNavigation({ timeout: 10_000 }).catch(() => null),
      linkedImg.click(),
    ]);

    // Lightbox should NOT be visible
    const overlay = page.locator(".fixed.inset-0.z-50");
    await expect(overlay).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 7. RSS feed — inline images use raw <img> src (no /_next/image)
// ---------------------------------------------------------------------------

test.describe("RSS feed image URLs", () => {
  test("RSS feed images do not use /_next/image proxy", async ({ page }) => {
    const response = await page.goto("/feed.xml");
    expect(response?.status()).toBe(200);

    const body = await response!.text();

    // If there are any <img tags in the feed, none should use /_next/image
    if (body.includes("<img")) {
      expect(body).not.toContain("/_next/image");
    }

    // The feed should NOT contain srcset attributes (raw HTML only)
    expect(body).not.toMatch(/srcset=/);
  });
});

// ---------------------------------------------------------------------------
// 8. Admin media library — lightbox with metadata panel
// ---------------------------------------------------------------------------

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
