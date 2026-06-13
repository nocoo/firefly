/**
 * L3 E2E: Blog archive index page
 *
 * Covers: /(blog)/archive/page.tsx — the heatmap overview that links every
 * year × month with published posts to its month archive page.
 *
 * The seed DB may have zero published posts, in which case the page falls
 * back to an empty state. Tests handle both branches.
 */
import { test, expect } from "@playwright/test";

test.describe("Blog archive index page", () => {
  test("archive index loads with heading", async ({ page }) => {
    await page.goto("/archive", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/archive$/);

    const heading = page.locator("header h1").first();
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText(/归档/);
  });

  test("archive index shows either the heatmap or the empty state", async ({
    page,
  }) => {
    await page.goto("/archive", { waitUntil: "networkidle" });

    const heatmap = page.locator(".archive-heatmap, [role='figure']");
    const emptyState = page.getByText(/尚未发布任何文章/);

    const hasHeatmap = (await heatmap.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasHeatmap || hasEmpty).toBe(true);
  });

  test("heatmap month cells link to /archive/YYYY-MM when posts exist", async ({
    page,
  }) => {
    await page.goto("/archive", { waitUntil: "networkidle" });

    // Only filled cells render as links; empty months are placeholder spans.
    const monthLinks = page.locator(".archive-heatmap a[href^='/archive/']");
    const count = await monthLinks.count();
    if (count === 0) return;

    // Year header anchors look like /archive/YYYY — skip those and find a
    // month cell, which carries /archive/YYYY-MM.
    let monthHref: string | null = null;
    for (let i = 0; i < count; i++) {
      const href = await monthLinks.nth(i).getAttribute("href");
      if (href && /^\/archive\/\d{4}-\d{2}$/.test(href)) {
        monthHref = href;
        break;
      }
    }
    expect(monthHref).toMatch(/^\/archive\/\d{4}-\d{2}$/);
  });

  test("clicking a year label navigates to that year's archive", async ({
    page,
  }) => {
    await page.goto("/archive", { waitUntil: "networkidle" });

    const yearLink = page.locator(".archive-heatmap-year").first();
    if ((await yearLink.count()) === 0) return;

    const href = await yearLink.getAttribute("href");
    expect(href).toMatch(/^\/archive\/\d{4}$/);

    await yearLink.click();
    await page.waitForURL(/\/archive\/\d{4}$/, { timeout: 10_000 });
    await expect(page.locator("header h1")).toBeVisible();
  });

  test("clicking a month cell navigates to that month's archive", async ({
    page,
  }) => {
    await page.goto("/archive", { waitUntil: "networkidle" });

    const monthLinks = page.locator(".archive-heatmap a[href^='/archive/']");
    const count = await monthLinks.count();
    if (count === 0) return;

    // Filter to month-format links only.
    let target: number = -1;
    for (let i = 0; i < count; i++) {
      const href = await monthLinks.nth(i).getAttribute("href");
      if (href && /^\/archive\/\d{4}-\d{2}$/.test(href)) {
        target = i;
        break;
      }
    }
    if (target === -1) return;

    await monthLinks.nth(target).click();
    await page.waitForURL(/\/archive\/\d{4}-\d{2}/, { timeout: 10_000 });
    await expect(page.locator("header h1")).toBeVisible();
  });

  test("archive index has proper SEO meta tags", async ({ page }) => {
    await page.goto("/archive", { waitUntil: "networkidle" });

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title).toMatch(/归档/);

    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute("content", /.+/);

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute("href", /\/archive$/);
  });
});
