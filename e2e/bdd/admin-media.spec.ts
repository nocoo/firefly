/**
 * L3 BDD: Admin media library + lightbox.
 *
 * Phase 3.2 of L3 → BDD migration (see docs/25-l3-bdd-refactor.md §3, §4.2).
 *
 * Source spec attribution (9 → 7 scenarios, TWO explicit merges):
 *   - browser/admin-media.spec.ts (7 tests across 2 describes)
 *   - browser/content-images.spec.ts admin scope (2 tests in 1 describe;
 *     remaining content/SEO scope already migrated in Phase 1.1/1.4 — full
 *     attribution per docs/25-l3-bdd-refactor.md §1.2.1)
 *
 * Mapping (old test → new scenario):
 *
 * --- Admin media library page (5 + 1 → 5) ---
 *   admin-media "media page loads"
 *     + content-images "media library page loads" [MERGED #1: page-load]
 *       → "Given /admin/media is requested, ... AdminShell h1 (媒体库) is visible"
 *   admin-media "shows media grid with thumbnails"
 *       → "Given /admin/media renders, ... the filter bar is visible; empty
 *          branch surfaces 暂无媒体文件 copy, non-empty branch surfaces first
 *          .grid .aspect-square card"
 *   admin-media "has search input for filtering files"
 *       → "Given /admin/media renders, ... the 搜索文件 placeholder text input
 *          is visible"
 *   admin-media "year filter dropdown is present and functional"
 *       → "Given /admin/media renders, ... the year <select> (containing
 *          全部年份 option, ≥1 options) is visible — hard assert, no silent skip"
 *   admin-media "mime type filter dropdown is present"
 *       → "Given /admin/media renders, ... the mime <select> (containing
 *          所有类型 option, ≥2 options) is visible — hard assert, no silent skip"
 *
 * --- Admin media library lightbox (2 + 1 → 2) ---
 *   admin-media "clicking media thumbnail opens lightbox with image"
 *       → "Given /admin/media renders with ≥1 image-mime card, ... clicking the
 *          first image card surfaces the ImageLightbox overlay + <img>;
 *          test.skip with explicit reason on empty/non-image-only seed"
 *   admin-media "lightbox shows metadata panel with file info"
 *     + content-images "clicking a media thumbnail opens lightbox with metadata"
 *       [MERGED #2: lightbox metadata + Escape close]
 *       → "Given /admin/media renders with ≥1 media card, ... clicking the
 *          first card surfaces the overlay with h3 filename + ≥1 action button
 *          (复制链接|复制 Markdown|删除); Escape closes the overlay"
 *
 * Reviewer pins (msg=abfdcf0d) honored:
 *   1. content-images.spec.ts is deleted in this commit — all 9 of its source
 *      tests are now attributed across seo-rss (Phase 1.1, 3) / blog-content
 *      (Phase 1.4, 4) / admin-media (this commit, 2).
 *   2. Image-lightbox scenario filters grid cards by descendant <img>; non-image
 *      cards render previewContent (FileTypeIcon) and would not satisfy the
 *      <img> assertion. test.skip when no image card exists.
 *   3. Metadata-lightbox scenario positively asserts the h3 filename + ≥1
 *      action button inside the overlay — not the fragile .border-l/.border-t
 *      shell.
 *   4. Grid scenario asserts filter-bar visibility first, then per-state branch
 *      (empty: 暂无媒体文件 copy; non-empty: first card visible). Never
 *      count-only.
 *   5. Filter <select> scenarios hard-assert visibility + option count (year ≥1,
 *      mime ≥2) — components fixed-render these selects, so any regression
 *      should fail.
 *   6. Commit body spells out both merges explicitly + content-images
 *      attribution completion + old file deletion rationale.
 */
import { test, expect } from "./fixtures";

// ---------------------------------------------------------------------------
// Local helper — path-level URL guard (same pattern as admin-taxonomy.spec.ts
// / admin-settings.spec.ts / admin-backup-mcp.spec.ts).
// ---------------------------------------------------------------------------

async function expectPathname(
  page: import("@playwright/test").Page,
  expected: string,
): Promise<void> {
  const { pathname } = new URL(page.url());
  expect(pathname).toBe(expected);
}

// ---------------------------------------------------------------------------
// Feature: Admin media library page
// ---------------------------------------------------------------------------

test.describe("Feature: Admin media library page", () => {
  test("Given /admin/media is requested, When I open it, Then the AdminShell h1 (媒体库) is visible", async ({
    page,
  }) => {
    await page.goto("/admin/media", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/media");

    // AdminShell h1 — i18n key "admin.page.media" → "媒体库"
    // (src/lib/i18n/index.ts:36, src/components/admin/shell.tsx:28).
    await expect(
      page.getByRole("heading", { level: 1, name: "媒体库" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/media renders, When I view the grid, Then the filter bar is visible and per-state surfaces 暂无媒体文件 (empty) OR the first grid card (non-empty)", async ({
    page,
  }) => {
    await page.goto("/admin/media", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/media");

    // Positive anchor: filter bar is always rendered regardless of grid state
    // (media-library.tsx:177). Use the 搜索文件 input as the stable signature —
    // it has a unique placeholder.
    const searchInput = page.getByPlaceholder("搜索文件...");
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    // CSS locator — grid cards have no role/testid; .grid .aspect-square is
    // the stable layout signature from media-library-grid.tsx:111 + L26.
    const gridCards = page.locator(".grid .aspect-square");
    const cardCount = await gridCards.count();
    if (cardCount === 0) {
      // Empty-state copy from media-library.tsx:194 (no active filters).
      await expect(
        page.getByText("暂无媒体文件", { exact: true }),
      ).toBeVisible();
    } else {
      await expect(gridCards.first()).toBeVisible();
    }
  });

  test("Given /admin/media renders, When I view the filter bar, Then the 搜索文件 placeholder input is visible", async ({
    page,
  }) => {
    await page.goto("/admin/media", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/media");

    // media-library-filter-bar.tsx:43 — placeholder is exactly "搜索文件..."
    // (note: trailing ellipsis is literal "..." not unicode "…").
    await expect(
      page.getByPlaceholder("搜索文件..."),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/media renders, When I view the filter bar, Then the year <select> is visible with 全部年份 and at least one option", async ({
    page,
  }) => {
    await page.goto("/admin/media", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/media");

    // CSS locator: media-library-filter-bar.tsx:75-86 renders 4 <select>
    // controls — disambiguate by the literal "全部年份" placeholder option.
    // Component fixed-renders this select; failure is a real regression.
    const yearSelect = page.locator("select").filter({ hasText: "全部年份" });
    await expect(yearSelect).toBeVisible({ timeout: 10_000 });
    const optionCount = await yearSelect.locator("option").count();
    expect(
      optionCount,
      "year <select> should always render at least the 全部年份 placeholder option",
    ).toBeGreaterThanOrEqual(1);
  });

  test("Given /admin/media renders, When I view the filter bar, Then the mime <select> is visible with 所有类型 and at least two options", async ({
    page,
  }) => {
    await page.goto("/admin/media", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/media");

    // CSS locator: media-library-filter-bar.tsx:61-72 renders the mime select
    // with a fixed option list (所有类型 + JPEG/PNG/WebP/GIF/SVG = 6 options).
    // Hard-assert ≥2 — component always renders these.
    const mimeSelect = page.locator("select").filter({ hasText: "所有类型" });
    await expect(mimeSelect).toBeVisible({ timeout: 10_000 });
    const optionCount = await mimeSelect.locator("option").count();
    expect(
      optionCount,
      "mime <select> should always render 所有类型 + the fixed mime options",
    ).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Feature: Admin media library lightbox
// ---------------------------------------------------------------------------

test.describe("Feature: Admin media library lightbox", () => {
  test("Given /admin/media renders with at least one image-mime card, When I click the first image card, Then the ImageLightbox overlay and its <img> are visible", async ({
    page,
  }) => {
    await page.goto("/admin/media", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/media");

    // Filter grid cards to those that render an <img> child — non-image mime
    // types render a FileTypeIcon instead (media-library-grid.tsx:38-45), and
    // ImageLightbox routes them through previewContent, so no <img> appears
    // in the overlay (image-lightbox.tsx:92-99).
    const imageCards = page
      .locator(".grid .aspect-square")
      .filter({ has: page.locator("img") });
    const imageCount = await imageCards.count();
    test.skip(
      imageCount === 0,
      "No image-mime media available to drive image-lightbox scenario.",
    );

    await imageCards.first().click();

    // ImageLightbox root signature — image-lightbox.tsx:62-65.
    const overlay = page.locator(".fixed.inset-0.z-50");
    await expect(overlay).toBeVisible({ timeout: 5_000 });
    // .first() because the overlay also contains the side-panel which itself
    // is descendant; we want the main pane <img> from image-lightbox.tsx:93.
    await expect(overlay.locator("img").first()).toBeVisible();
  });

  test("Given /admin/media renders with at least one media card, When I click the first card, Then the overlay shows the filename h3 + at least one action button, and Escape closes it", async ({
    page,
  }) => {
    await page.goto("/admin/media", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/media");

    // Any card type works here — image OR non-image both render the
    // MediaLibraryPreview side panel with h3 filename + 3 action buttons
    // (media-library-preview.tsx:43, L74-96).
    const cards = page.locator(".grid .aspect-square");
    const cardCount = await cards.count();
    test.skip(
      cardCount === 0,
      "No media available to drive lightbox metadata scenario.",
    );

    await cards.first().click();

    const overlay = page.locator(".fixed.inset-0.z-50");
    await expect(overlay).toBeVisible({ timeout: 5_000 });

    // Positive metadata assertions — h3 filename (preview.tsx:43-45) + at
    // least one action button. Scoped to overlay so unrelated page buttons
    // cannot satisfy.
    await expect(
      overlay.getByRole("heading", { level: 3 }),
    ).toBeVisible();
    await expect(
      overlay.getByRole("button", { name: "复制链接" }),
    ).toBeVisible();

    // Escape closes overlay — image-lightbox.tsx:38-45 keyboard handler.
    await page.keyboard.press("Escape");
    await expect(overlay).not.toBeVisible();
  });
});
