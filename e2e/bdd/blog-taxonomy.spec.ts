/**
 * L3 BDD: Taxonomy pages — category page, tag page, archive index.
 *
 * Phase 1.3 of L3 → BDD migration (see docs/25-l3-bdd-refactor.md §3, §4.2).
 *
 * Source spec attribution (20 → 17 tests):
 *   - browser/blog-category.spec.ts  (7 tests)
 *   - browser/blog-tag.spec.ts       (7 tests)
 *   - browser/blog-archive.spec.ts   (6 tests)
 *
 * Mapping (old test → new scenario):
 *   browser/blog-category.spec.ts "category page loads with heading and post count"
 *     + browser/blog-category.spec.ts "category page shows post cards or empty state"
 *       → "Given a category link on the home page, ... the category page shows a heading, post count, and either post cards or empty state"
 *   browser/blog-category.spec.ts "category page has JSON-LD structured data"
 *       → "Given a category page, ... it embeds JSON-LD structured data"
 *   browser/blog-category.spec.ts "category page has proper meta tags"
 *       → "Given a category page, ... <title> is non-empty and og:title is populated"
 *   browser/blog-category.spec.ts "clicking a post card navigates to the post detail page"
 *       → "Given a category page with post cards, ... clicking a card navigates to /YYYY/MM/"
 *   browser/blog-category.spec.ts "post cards display title, date, and excerpt"
 *       → "Given a category page with post cards, ... each card shows title and date"
 *   browser/blog-category.spec.ts "non-existent category returns 404"
 *       → "Given a non-existent category slug, ... visiting it returns 404"
 *
 *   browser/blog-tag.spec.ts "tag page loads with heading and post count"
 *     + browser/blog-tag.spec.ts "tag page shows post cards or empty state"
 *       → "Given a tag link on the home page, ... the tag page shows a #-prefixed heading, post count, and either post cards or empty state"
 *   browser/blog-tag.spec.ts "tag page has JSON-LD structured data"
 *       → "Given a tag page, ... it embeds JSON-LD structured data"
 *   browser/blog-tag.spec.ts "tag page has proper meta tags"
 *       → "Given a tag page, ... <title> is non-empty and contains '#'"
 *   browser/blog-tag.spec.ts "clicking a post card navigates to the post detail page"
 *       → "Given a tag page with post cards, ... clicking a card navigates to /YYYY/MM/"
 *   browser/blog-tag.spec.ts "thin-content tag has noindex robots directive"
 *       → "Given a tag with fewer than 3 posts, ... it emits a noindex robots directive"
 *   browser/blog-tag.spec.ts "non-existent tag returns 404"
 *       → "Given a non-existent tag slug, ... visiting it returns 404"
 *
 *   browser/blog-archive.spec.ts "archive index loads with heading"
 *     + browser/blog-archive.spec.ts "archive index shows either the heatmap or the empty state"
 *       → "Given the archive index page, ... it renders a 归档 heading and either the heatmap or the empty state"
 *   browser/blog-archive.spec.ts "heatmap month cells link to /archive/YYYY-MM when posts exist"
 *       → "Given heatmap month cells exist, ... each links to /archive/YYYY-MM"
 *   browser/blog-archive.spec.ts "clicking a year label navigates to that year's archive"
 *       → "Given a year label exists in the heatmap, ... clicking it opens /archive/YYYY"
 *   browser/blog-archive.spec.ts "clicking a month cell navigates to that month's archive"
 *       → "Given a month cell exists in the heatmap, ... clicking it opens /archive/YYYY-MM"
 *   browser/blog-archive.spec.ts "archive index has proper SEO meta tags"
 *       → "Given the archive index page, ... <title> contains 归档, og:title is populated, canonical points to /archive"
 */
import { test, expect, emptyDataGate } from "./fixtures";
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers — locate a category/tag link on the home page and navigate to it.
// CSS attribute selector for href prefix: category/tag links carry no role,
// label, or testid; the distinguishing structural trait is the href prefix.
// ---------------------------------------------------------------------------

async function gotoFirstCategoryFromHome(page: Page): Promise<string | null> {
  await page.goto("/", { waitUntil: "networkidle" });
  const link = page.locator("a[href^='/category/']").first();
  if ((await link.count()) === 0) return null;
  const href = await link.getAttribute("href");
  if (!href) return null;
  await page.goto(href, { waitUntil: "networkidle" });
  return href;
}

async function gotoFirstTagFromHome(page: Page): Promise<string | null> {
  await page.goto("/", { waitUntil: "networkidle" });
  const link = page.locator("a[href^='/tag/']").first();
  if ((await link.count()) === 0) return null;
  const href = await link.getAttribute("href");
  if (!href) return null;
  await page.goto(href, { waitUntil: "networkidle" });
  return href;
}

// ---------------------------------------------------------------------------
// Feature: Category page
// ---------------------------------------------------------------------------

test.describe("Feature: Category page", () => {
  test("Given a category link on the home page, When I open it, Then I see a heading, post count, and either post cards or empty state", async ({
    page,
  }) => {
    // Given: a category link exists on the home page
    const href = await gotoFirstCategoryFromHome(page);
    const gate = emptyDataGate(href === null ? 0 : 1, "category links on home");
    test.skip(gate.skip, gate.reason);

    // Then: URL is /category/<slug>
    await expect(page).toHaveURL(/\/category\//);

    // Then: page header h1 is visible.
    // CSS selector "header h1": the site sidebar also renders an h1 (site
    // title), so getByRole('heading', {level:1}).first() would match that
    // instead. The taxonomy page header is the unique h1 inside a <header>.
    await expect(page.locator("header h1")).toBeVisible();

    // Then: a "N 篇文章" post-count line is rendered.
    // getByText regex: no semantic role exists for this status string and the
    // exact prefix is locale-content, not structural.
    await expect(page.getByText(/篇文章/)).toBeVisible();

    // Then: the body shows either post cards or the empty-state copy
    const postCard = page.getByRole("article");
    const emptyState = page.getByText(/该分类下暂无文章/);
    const hasCards = (await postCard.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasCards || hasEmpty).toBe(true);
  });

  test("Given a category page, When I inspect JSON-LD, Then it embeds structured data with a valid schema shape", async ({
    page,
  }) => {
    // Given: navigate to a category page
    const href = await gotoFirstCategoryFromHome(page);
    const gate = emptyDataGate(href === null ? 0 : 1, "category links on home");
    test.skip(gate.skip, gate.reason);

    // Then: at least one JSON-LD block is present with @context or @type.
    // CSS attribute selector: <script type="application/ld+json"> is the
    // standard JSON-LD embedding pattern; no semantic role applies.
    const ldJson = page.locator('script[type="application/ld+json"]');
    expect(await ldJson.count()).toBeGreaterThan(0);
    const content = await ldJson.first().textContent();
    expect(content).toBeTruthy();
    const data = JSON.parse(content!) as Record<string, unknown>;
    expect(data["@context"] ?? data["@type"]).toBeTruthy();
  });

  test("Given a category page, When I inspect meta, Then <title> is non-empty and og:title is populated", async ({
    page,
  }) => {
    // Given: navigate to a category page
    const href = await gotoFirstCategoryFromHome(page);
    const gate = emptyDataGate(href === null ? 0 : 1, "category links on home");
    test.skip(gate.skip, gate.reason);

    // Then: <title> is non-empty
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // Then: og:title is populated.
    // CSS attribute selector: meta tags have no role/label/testid.
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /.+/,
    );
  });

  test("Given a category page with post cards, When I click a card, Then I land on /YYYY/MM/", async ({
    page,
  }) => {
    // Given: navigate to a category page; cards may be empty
    const href = await gotoFirstCategoryFromHome(page);
    const gateNav = emptyDataGate(href === null ? 0 : 1, "category links on home");
    test.skip(gateNav.skip, gateNav.reason);

    const article = page.getByRole("article").first();
    const articleCount = await article.count();
    const gate = emptyDataGate(articleCount, "category page post cards");
    test.skip(gate.skip, gate.reason);

    // When: click the post card title link.
    // PostCard renders a single <h2><a>, so the first link in the article
    // is the title link.
    const postLink = article.getByRole("link").first();
    const postHref = await postLink.getAttribute("href");
    expect(postHref).toMatch(/\/\d{4}\/\d{2}\//);

    await postLink.click();
    await page.waitForURL(/\/\d{4}\/\d{2}\//, { timeout: 10_000 });

    // Then: detail page renders an h1
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible();
  });

  test("Given a category page with post cards, When I view a card, Then it shows a title and a date", async ({
    page,
  }) => {
    // Given: navigate to a category page; cards may be empty
    const href = await gotoFirstCategoryFromHome(page);
    const gateNav = emptyDataGate(href === null ? 0 : 1, "category links on home");
    test.skip(gateNav.skip, gateNav.reason);

    const article = page.getByRole("article").first();
    const articleCount = await article.count();
    const gate = emptyDataGate(articleCount, "category page post cards");
    test.skip(gate.skip, gate.reason);

    // Then: card exposes a title link and a <time> element.
    // CSS tag selector "time": no ARIA role exists for <time>; this is the
    // documented Playwright pattern.
    await expect(article.getByRole("link").first()).toBeVisible();
    await expect(article.locator("time")).toBeVisible();
  });

  test("Given a non-existent category slug, When I visit it, Then it returns 404", async ({
    page,
  }) => {
    // Given/When: visit a deliberately impossible category slug
    const response = await page.goto("/category/non-existent-slug-12345", {
      waitUntil: "networkidle",
    });

    // Then: status is 404
    expect(response?.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Feature: Tag page
// ---------------------------------------------------------------------------

test.describe("Feature: Tag page", () => {
  test("Given a tag link on the home page, When I open it, Then I see a #-prefixed heading, post count, and either post cards or empty state", async ({
    page,
  }) => {
    // Given: a tag link exists on the home page
    const href = await gotoFirstTagFromHome(page);
    const gate = emptyDataGate(href === null ? 0 : 1, "tag links on home");
    test.skip(gate.skip, gate.reason);

    // Then: URL is /tag/<slug>
    await expect(page).toHaveURL(/\/tag\//);

    // Then: page header h1 starts with '#' (tag rendering convention).
    // CSS selector "header h1": same sidebar-h1 disambiguation as Category.
    const heading = page.locator("header h1");
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();
    expect(headingText).toMatch(/^#/);

    // Then: post-count line is rendered.
    await expect(page.getByText(/篇文章/)).toBeVisible();

    // Then: the body shows either post cards or the empty-state copy
    const postCard = page.getByRole("article");
    const emptyState = page.getByText(/该标签下暂无文章/);
    const hasCards = (await postCard.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasCards || hasEmpty).toBe(true);
  });

  test("Given a tag page, When I inspect JSON-LD, Then it embeds structured data with a valid schema shape", async ({
    page,
  }) => {
    // Given: navigate to a tag page
    const href = await gotoFirstTagFromHome(page);
    const gate = emptyDataGate(href === null ? 0 : 1, "tag links on home");
    test.skip(gate.skip, gate.reason);

    // Then: at least one JSON-LD block is present with @context or @type.
    // CSS attribute selector: <script type="application/ld+json">.
    const ldJson = page.locator('script[type="application/ld+json"]');
    expect(await ldJson.count()).toBeGreaterThan(0);
    const content = await ldJson.first().textContent();
    expect(content).toBeTruthy();
    const data = JSON.parse(content!) as Record<string, unknown>;
    expect(data["@context"] ?? data["@type"]).toBeTruthy();
  });

  test("Given a tag page, When I inspect meta, Then <title> is non-empty and contains '#'", async ({
    page,
  }) => {
    // Given: navigate to a tag page
    const href = await gotoFirstTagFromHome(page);
    const gate = emptyDataGate(href === null ? 0 : 1, "tag links on home");
    test.skip(gate.skip, gate.reason);

    // Then: <title> includes the tag '#' marker
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title).toMatch(/#/);
  });

  test("Given a tag page with post cards, When I click a card, Then I land on /YYYY/MM/", async ({
    page,
  }) => {
    // Given: navigate to a tag page; cards may be empty
    const href = await gotoFirstTagFromHome(page);
    const gateNav = emptyDataGate(href === null ? 0 : 1, "tag links on home");
    test.skip(gateNav.skip, gateNav.reason);

    const article = page.getByRole("article").first();
    const articleCount = await article.count();
    const gate = emptyDataGate(articleCount, "tag page post cards");
    test.skip(gate.skip, gate.reason);

    // When: click the post card title link
    const postLink = article.getByRole("link").first();
    const postHref = await postLink.getAttribute("href");
    expect(postHref).toMatch(/\/\d{4}\/\d{2}\//);

    await postLink.click();
    await page.waitForURL(/\/\d{4}\/\d{2}\//, { timeout: 10_000 });

    // Then: detail page renders an h1
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible();
  });

  test("Given a tag with fewer than 3 posts, When I view it, Then it emits a noindex robots directive", async ({
    page,
  }) => {
    // Given: navigate to a tag page
    const href = await gotoFirstTagFromHome(page);
    const gate = emptyDataGate(href === null ? 0 : 1, "tag links on home");
    test.skip(gate.skip, gate.reason);

    // CSS attribute selector: meta tags have no role/label/testid.
    const robots = page.locator('meta[name="robots"]');

    // The post-count copy is "N 篇文章" — parseInt grabs the leading integer.
    const postCountText = await page.getByText(/篇文章/).textContent();
    const count = parseInt(postCountText ?? "0", 10);

    if (count < 3) {
      // Then: thin-content tag carries noindex
      await expect(robots).toHaveAttribute("content", /noindex/);
    } else {
      // Then: regular tag does NOT mark itself noindex
      const robotsCount = await robots.count();
      if (robotsCount > 0) {
        const content = await robots.getAttribute("content");
        expect(content).not.toMatch(/noindex/);
      }
    }
  });

  test("Given a non-existent tag slug, When I visit it, Then it returns 404", async ({
    page,
  }) => {
    // Given/When: visit a deliberately impossible tag slug
    const response = await page.goto("/tag/non-existent-slug-12345", {
      waitUntil: "networkidle",
    });

    // Then: status is 404
    expect(response?.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Feature: Archive index page
// ---------------------------------------------------------------------------

test.describe("Feature: Archive index page", () => {
  test("Given the archive index page, When I open /archive, Then it renders a 归档 heading and either the heatmap or the empty state", async ({
    page,
  }) => {
    // Given/When: open the archive index
    await page.goto("/archive", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/archive$/);

    // Then: page header h1 contains "归档".
    // CSS selector "header h1": same sidebar-h1 disambiguation as Category/Tag.
    const heading = page.locator("header h1").first();
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText(/归档/);

    // Then: the body shows either the heatmap or the empty-state copy.
    // CSS selectors: .archive-heatmap is the component class root; [role='figure']
    // is the documented ARIA fallback for non-image figure markup; getByText
    // matches the locale-string empty state.
    const heatmap = page.locator(".archive-heatmap, [role='figure']");
    const emptyState = page.getByText(/尚未发布任何文章/);
    const hasHeatmap = (await heatmap.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasHeatmap || hasEmpty).toBe(true);
  });

  test("Given heatmap month cells exist, When I inspect them, Then each links to /archive/YYYY-MM", async ({
    page,
  }) => {
    // Given: open the archive index; month cells may be absent
    await page.goto("/archive", { waitUntil: "networkidle" });

    // CSS selector ".archive-heatmap a[href^='/archive/']": filled month
    // cells render as anchor children of the heatmap; empty months render
    // as placeholder spans (no href). No role/testid is exposed per cell.
    const monthLinks = page.locator(".archive-heatmap a[href^='/archive/']");
    const count = await monthLinks.count();
    const gate = emptyDataGate(count, "archive heatmap month links");
    test.skip(gate.skip, gate.reason);

    // Then: at least one anchor matches /archive/YYYY-MM (year headers use
    // /archive/YYYY and must be skipped).
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

  test("Given a year label exists in the heatmap, When I click it, Then I land on /archive/YYYY", async ({
    page,
  }) => {
    // Given: open the archive index; year label may be absent
    await page.goto("/archive", { waitUntil: "networkidle" });

    // CSS class selector ".archive-heatmap-year": the year label is a
    // dedicated component anchor with no exposed role/testid.
    const yearLink = page.locator(".archive-heatmap-year").first();
    const gate = emptyDataGate(await yearLink.count(), "archive heatmap year labels");
    test.skip(gate.skip, gate.reason);

    // Then: href matches /archive/YYYY
    const href = await yearLink.getAttribute("href");
    expect(href).toMatch(/^\/archive\/\d{4}$/);

    // When: click the year label
    await yearLink.click();
    await page.waitForURL(/\/archive\/\d{4}$/, { timeout: 10_000 });

    // Then: the year archive page renders a header h1
    await expect(page.locator("header h1")).toBeVisible();
  });

  test("Given a month cell exists in the heatmap, When I click it, Then I land on /archive/YYYY-MM", async ({
    page,
  }) => {
    // Given: open the archive index; month cells may be absent
    await page.goto("/archive", { waitUntil: "networkidle" });

    const monthLinks = page.locator(".archive-heatmap a[href^='/archive/']");
    const count = await monthLinks.count();
    const gateAny = emptyDataGate(count, "archive heatmap month links");
    test.skip(gateAny.skip, gateAny.reason);

    // Find a month-format anchor specifically (skip year headers).
    let target = -1;
    for (let i = 0; i < count; i++) {
      const href = await monthLinks.nth(i).getAttribute("href");
      if (href && /^\/archive\/\d{4}-\d{2}$/.test(href)) {
        target = i;
        break;
      }
    }
    const gate = emptyDataGate(target === -1 ? 0 : 1, "archive heatmap month cells");
    test.skip(gate.skip, gate.reason);

    // When: click the month cell
    await monthLinks.nth(target).click();
    await page.waitForURL(/\/archive\/\d{4}-\d{2}/, { timeout: 10_000 });

    // Then: the month archive page renders a header h1
    await expect(page.locator("header h1")).toBeVisible();
  });

  test("Given the archive index page, When I inspect SEO meta, Then <title> contains 归档, og:title is populated, canonical points to /archive", async ({
    page,
  }) => {
    // Given/When: open the archive index
    await page.goto("/archive", { waitUntil: "networkidle" });

    // Then: <title> includes "归档"
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title).toMatch(/归档/);

    // Then: og:title is populated.
    // CSS attribute selector: meta tags have no role/label/testid.
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /.+/,
    );

    // Then: <link rel="canonical"> points to /archive
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/archive$/,
    );
  });
});
