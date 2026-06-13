/**
 * L3 BDD: Blog reading — home page, post-card navigation, post detail rendering,
 * taxonomy byline links, archive page, and post-detail SEO/JSON-LD/404.
 *
 * Phase 1.2 of L3 → BDD migration (see docs/25-l3-bdd-refactor.md §3, §4.2).
 *
 * Source spec attribution (14 → 11 tests):
 *   - browser/blog-navigation.spec.ts   (7 tests)
 *   - browser/blog-post-detail.spec.ts  (7 tests)
 *
 * Mapping (old test → new scenario):
 *   browser/blog-navigation.spec.ts "home page loads with blog posts"
 *     + browser/blog-navigation.spec.ts "post card displays title, date, and links to post"
 *       → "Given the home page renders, ... title is non-empty and (if present) post cards expose title/date/link"
 *   browser/blog-navigation.spec.ts "clicking post title navigates to post detail"
 *       → "Given a published post exists, ... clicking its card title opens the post detail page"
 *   browser/blog-navigation.spec.ts "category page loads"
 *       → "Given the home page lists category links, ... clicking one opens the category page"
 *   browser/blog-navigation.spec.ts "tag page loads"
 *       → "Given the home page lists tag links, ... clicking one opens the tag page"
 *   browser/blog-navigation.spec.ts "archive page loads with year heading"
 *     + browser/blog-navigation.spec.ts "archive page shows post count"
 *       → "Given an archive year page, ... I see the year heading and a post-count line"
 *   browser/blog-post-detail.spec.ts "post detail loads with title, date, and body content"
 *       → "Given a post detail page, ... I see the title, publish date, and body content"
 *   browser/blog-post-detail.spec.ts "category byline link is clickable when post has a category"
 *       → "Given a post with a category byline, ... the byline link navigates to the category page"
 *   browser/blog-post-detail.spec.ts "tag pills link to their tag pages when present"
 *       → "Given a post with tag pills, ... clicking a pill navigates to its tag page"
 *   browser/blog-post-detail.spec.ts "post detail includes JSON-LD with an Article-family schema"
 *     + browser/blog-post-detail.spec.ts "post detail emits BreadcrumbList JSON-LD for navigation"
 *       → "Given a post detail page, ... it embeds both BlogPosting/Article and BreadcrumbList JSON-LD"
 *   browser/blog-post-detail.spec.ts "non-existent slug returns 404"
 *       → "Given a slug that does not exist, ... visiting it returns 404"
 *   browser/blog-post-detail.spec.ts "post detail has article-typed SEO meta tags and canonical URL"
 *       → "Given a post detail page, ... og:type is article and link[rel=canonical] points to /YYYY/MM/"
 */
import { test, expect, emptyDataGate, gotoFirstPost } from "./fixtures";

// ---------------------------------------------------------------------------
// Feature: Home page & post navigation
// ---------------------------------------------------------------------------

test.describe("Feature: Home page & post navigation", () => {
  test("Given the home page renders, When I view it, Then title is non-empty and (if present) post cards expose title/date/link", async ({
    page,
  }) => {
    // Given/When: load the home page
    await page.goto("/", { waitUntil: "networkidle" });

    // Then: <title> is non-empty (site name is user-configurable)
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // Then: if any post cards exist, the first card exposes title/date/link.
    // Home renders post cards as <article> via PostCard.
    const articles = page.getByRole("article");
    const count = await articles.count();
    const gate = emptyDataGate(count, "home page articles");
    test.skip(gate.skip, gate.reason);

    const article = articles.first();
    await expect(article).toBeVisible();

    // Title link is the single <h2><a> inside the card.
    const titleLink = article.getByRole("link").first();
    const href = await titleLink.getAttribute("href");
    expect(href).toMatch(/\/\d{4}\/\d{2}\//);

    // Publish date — rendered inside a <time> element. No ARIA role exists
    // for <time>; CSS tag selector is the documented Playwright pattern.
    await expect(article.locator("time")).toBeVisible();
  });

  test("Given a published post exists, When I click its card title, Then I land on the post detail page", async ({
    page,
  }) => {
    // Given: a published post exists (gotoFirstPost gates on this)
    // When: click the first post card title
    const url = await gotoFirstPost(page);
    const gate = emptyDataGate(url === null ? 0 : 1, "published posts");
    test.skip(gate.skip, gate.reason);

    // Then: URL matches /YYYY/MM/ and an h1 heading is visible
    expect(url).toMatch(/\/\d{4}\/\d{2}\//);
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible();
  });

  test("Given the home page lists category links, When I click one, Then it opens the category page", async ({
    page,
  }) => {
    // Given: the home page may expose category links inside post bylines.
    // CSS attribute selector: category links have no role/testid; their
    // distinguishing trait is the href prefix.
    await page.goto("/");
    const categoryLink = page.locator("a[href^='/category/']").first();
    const count = await categoryLink.count();
    const gate = emptyDataGate(count, "category links on home");
    test.skip(gate.skip, gate.reason);

    // When: click the first category link
    await Promise.all([
      page.waitForURL(/\/category\//, { timeout: 10_000 }),
      categoryLink.click(),
    ]);

    // Then: the category page renders a heading
    await expect(
      page.getByRole("heading").first(),
    ).toBeVisible();
  });

  test("Given the home page lists tag links, When I click one, Then it opens the tag page", async ({
    page,
  }) => {
    // Given: the home page may expose tag links inside post bylines.
    // CSS attribute selector: tag links have no role/testid; their
    // distinguishing trait is the href prefix.
    await page.goto("/");
    const tagLink = page.locator("a[href^='/tag/']").first();
    const count = await tagLink.count();
    const gate = emptyDataGate(count, "tag links on home");
    test.skip(gate.skip, gate.reason);

    // When: click the first tag link
    await Promise.all([
      page.waitForURL(/\/tag\//, { timeout: 10_000 }),
      tagLink.click(),
    ]);

    // Then: the tag page renders a heading
    await expect(
      page.getByRole("heading").first(),
    ).toBeVisible();
  });

  test("Given an archive year page, When I open /archive/YYYY, Then I see the year heading and a post-count line", async ({
    page,
  }) => {
    // Given/When: open the current-year archive page
    const year = new Date().getFullYear();
    await page.goto(`/archive/${year}`, { waitUntil: "networkidle" });

    // Then: the archive page heading includes the year.
    // CSS selector "header h1": the site sidebar also renders an h1 (site
    // title), so getByRole('heading', {level:1}).first() would match that
    // instead. The archive page header is the unique h1 inside a <header>.
    const heading = page.locator("header h1").first();
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();
    expect(headingText).toContain(String(year));

    // Then: a "N 篇文章" post-count line is rendered.
    // getByText regex: no semantic role exists for this status string and the
    // exact prefix is locale-content, not structural.
    await expect(page.getByText(/篇文章/)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Feature: Post detail rendering
// ---------------------------------------------------------------------------

test.describe("Feature: Post detail rendering", () => {
  test("Given a post detail page, When I load it, Then I see the title, publish date, and body content", async ({
    page,
  }) => {
    // Given: navigate to the first published post
    const url = await gotoFirstPost(page);
    const gate = emptyDataGate(url === null ? 0 : 1, "published posts");
    test.skip(gate.skip, gate.reason);

    // Then: <h1> title is non-empty
    const h1 = page.getByRole("heading", { level: 1 }).first();
    await expect(h1).toBeVisible();
    const titleText = await h1.textContent();
    expect((titleText ?? "").trim().length).toBeGreaterThan(0);

    // Then: publish <time> exposes a YYYY-MM-DD datetime attribute
    const time = page.locator("time").first();
    await expect(time).toBeVisible();
    const dateTime = await time.getAttribute("datetime");
    expect(dateTime).toMatch(/\d{4}-\d{2}-\d{2}/);

    // Then: the article body container is visible. ArticleBody renders
    // a .article-body wrapper; fall back to <article> if the class is
    // restyled. Both are CSS selectors because no semantic role/testid
    // exists for the post body container.
    await expect(page.locator(".article-body, article").first()).toBeVisible();
  });

  test("Given a post with a category byline, When I click the byline category link, Then it navigates to the category page", async ({
    page,
  }) => {
    // Given: load a post detail page; not every post has a category link.
    const url = await gotoFirstPost(page);
    const gateLoad = emptyDataGate(url === null ? 0 : 1, "published posts");
    test.skip(gateLoad.skip, gateLoad.reason);

    // CSS selector: .blog-byline + href prefix — byline links have no role
    // or testid; the distinguishing structural trait is the byline class.
    const categoryLink = page.locator(".blog-byline a[href^='/category/']");
    const count = await categoryLink.count();
    const gate = emptyDataGate(count, "post category byline links");
    test.skip(gate.skip, gate.reason);

    // Then: href matches /category/...
    const href = await categoryLink.first().getAttribute("href");
    expect(href).toMatch(/^\/category\//);

    // When: click; Then: lands on the category page
    await categoryLink.first().click();
    await page.waitForURL(/\/category\//, { timeout: 10_000 });
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible();
  });

  test("Given a post with tag pills, When I click a pill, Then it navigates to the tag page", async ({
    page,
  }) => {
    // Given: load a post detail page; tag pills are optional.
    const url = await gotoFirstPost(page);
    const gateLoad = emptyDataGate(url === null ? 0 : 1, "published posts");
    test.skip(gateLoad.skip, gateLoad.reason);

    // CSS class selector: .blog-tag-pill is the dedicated tag-pill renderer.
    // No role/testid is exposed for individual tag pills.
    const tagPill = page.locator("a.blog-tag-pill").first();
    const count = await tagPill.count();
    const gate = emptyDataGate(count, "post tag pills");
    test.skip(gate.skip, gate.reason);

    // Then: href matches /tag/...
    const href = await tagPill.getAttribute("href");
    expect(href).toMatch(/^\/tag\//);

    // When: click; Then: lands on the tag page
    await tagPill.click();
    await page.waitForURL(/\/tag\//, { timeout: 10_000 });
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible();
  });

  test("Given a post detail page, When I inspect JSON-LD, Then it embeds both BlogPosting/Article and BreadcrumbList schemas", async ({
    page,
  }) => {
    // Given: load a post detail page
    const url = await gotoFirstPost(page);
    const gate = emptyDataGate(url === null ? 0 : 1, "published posts");
    test.skip(gate.skip, gate.reason);

    // CSS attribute selector: <script type="application/ld+json"> is the
    // standard JSON-LD embedding pattern; no semantic role applies.
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(blocks.length).toBeGreaterThanOrEqual(1);

    const parsed = blocks
      .map((b) => {
        try {
          return JSON.parse(b) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((d): d is Record<string, unknown> => d !== null);

    // Then: at least one block is BlogPosting or Article (Article-family)
    const articleLike = parsed.find(
      (d) => d["@type"] === "BlogPosting" || d["@type"] === "Article",
    );
    expect(articleLike).toBeTruthy();

    // Then: a BreadcrumbList block is also embedded
    const breadcrumb = parsed.find((d) => d["@type"] === "BreadcrumbList");
    expect(breadcrumb).toBeTruthy();
  });

  test("Given a slug that does not exist, When I visit /YYYY/MM/<slug>, Then it returns 404", async ({
    page,
  }) => {
    // Given/When: visit a deliberately impossible URL. Year/month don't need
    // to be plausible — getPostBySlug returning null triggers notFound()
    // before the URL date guard runs.
    const response = await page.goto(
      "/2099/01/non-existent-slug-12345",
      { waitUntil: "networkidle" },
    );

    // Then: status is 404
    expect(response?.status()).toBe(404);
  });

  test("Given a post detail page, When I inspect SEO meta, Then og:type is article and link[rel=canonical] points to /YYYY/MM/", async ({
    page,
  }) => {
    // Given: load a post detail page
    const url = await gotoFirstPost(page);
    const gate = emptyDataGate(url === null ? 0 : 1, "published posts");
    test.skip(gate.skip, gate.reason);

    // Then: <title> is non-empty
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // Then: og:title is populated and og:type is "article".
    // CSS attribute selector: <meta> tags have no role/label/testid.
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /.+/,
    );
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
      "content",
      "article",
    );

    // Then: <link rel="canonical"> points to the post's /YYYY/MM/ URL.
    // buildPageMeta surfaces alternates.canonical via this link element.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/\d{4}\/\d{2}\//,
    );
  });
});
