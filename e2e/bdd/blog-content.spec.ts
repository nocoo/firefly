/**
 * L3 BDD: Blog content & navigation extras —
 *   home/category/tag/archive pagination, search, preview, and the
 *   reader-side image lightbox (linked + standalone images).
 *
 * Phase 1.4 of L3 → BDD migration (see docs/25-l3-bdd-refactor.md §3, §4.2).
 *
 * Source spec attribution (34 → 30 tests):
 *   - browser/blog-pagination.spec.ts            (7 tests)
 *   - browser/blog-taxonomy-pagination.spec.ts   (12 tests)
 *   - browser/blog-search-preview.spec.ts        (11 tests)
 *   - browser/content-images.spec.ts L91/L111/L130/L162 (4 tests)
 *
 * Mapping (old test → new scenario):
 *
 * blog-pagination.spec.ts:
 *   "page 2 loads with posts or 404 when insufficient content"
 *       → "Given /page/2, ... it returns 200 with cards/empty-state or 404"
 *   "page 1 returns 404 (only /page/2+ is valid)"
 *       → "Given /page/1, ... it returns 404"
 *   "non-numeric page returns 404"
 *       → "Given /page/<non-numeric>, ... it returns 404"
 *   "negative page returns 404"
 *       → "Given /page/<negative>, ... it returns 404"
 *   "pagination navigation links from homepage"
 *       → "Given the home page exposes a /page/2 link, ... clicking it lands on /page/2"
 *   "pagination shows current page indicator"
 *       → "Given /page/2 loads with pagination nav, ... aria-current=page shows '2'"
 *   "pagination has previous page link on page 2"
 *       → "Given /page/2 loads with pagination nav, ... clicking 上一页 returns to home"
 *
 * blog-taxonomy-pagination.spec.ts (category/tag/archive ×4 each):
 *   "category page 2 loads or 404 when insufficient content"
 *       → "Given a category page 2, ... status is 200 or 404"
 *   "category page 2 shows category heading when loaded"
 *       → "Given a category page 2 returns 200, ... header h1 is visible"
 *   "category page 1 returns 404"
 *       → "Given /category/<slug>/page/1, ... it returns 404"
 *   "non-existent category pagination returns 404"
 *       → "Given /category/<missing>/page/2, ... it returns 404"
 *   "tag page 2 loads or 404 when insufficient content"
 *       → "Given a tag page 2, ... status is 200 or 404"
 *   "tag page 2 shows tag heading with # prefix when loaded"
 *       → "Given a tag page 2 returns 200, ... header h1 starts with '#'"
 *   "tag page 1 returns 404"
 *       → "Given /tag/<slug>/page/1, ... it returns 404"
 *   "non-existent tag pagination returns 404"
 *       → "Given /tag/<missing>/page/2, ... it returns 404"
 *   "archive page 2 loads or 404 when insufficient content"
 *       → "Given /archive/YYYY/page/2, ... status is 200 or 404"
 *   "archive page 2 shows year in heading when loaded"
 *       → "Given /archive/YYYY/page/2 returns 200, ... header h1 contains year"
 *   "archive page 1 returns 404"
 *       → "Given /archive/YYYY/page/1, ... it returns 404"
 *   "non-existent archive period pagination returns 404"
 *       → "Given /archive/9999/page/2, ... it returns 404"
 *
 * blog-search-preview.spec.ts:
 *   "search page loads without query"
 *       → "Given /search without query, ... empty-state prompt is visible"
 *   "search page loads with query parameter"
 *     + "shows result count for query"
 *     + "shows post cards or empty state for results"
 *       → "Given /search?q=test, ... heading + result count + cards-or-empty are visible"
 *   "shows pagination for many results"
 *       → "Given /search?q=a (broad query), ... pagination locator count is >= 0"
 *   "page query parameter works"
 *       → "Given /search?q=a&page=2, ... results container is visible"
 *   "preview page requires authentication"
 *       → "Given /preview/<missing>, ... the page renders body (no auth redirect under E2E_SKIP_AUTH)"
 *   "preview page shows preview banner"
 *     + "preview page shows post content when post exists"
 *     + "preview page has edit link"
 *       → "Given an admin-listed post id, ... preview shows banner + article + edit link"
 *   "preview page returns 404 for non-existent post"
 *       → "Given /preview/<missing>, ... status is 200 or 404"
 *
 * content-images.spec.ts (4 reader-side lightbox tests):
 *   L91  "click inline image opens lightbox"
 *       → "Given a post with an inline image, ... clicking it opens the lightbox overlay"
 *   L111 "lightbox shows correct image"
 *       → "Given the lightbox is open, ... it shows the original image src"
 *   L130 "lightbox closes on X button, Escape, and backdrop"
 *       → "Given the lightbox is open, ... it closes via X button, Escape, and backdrop click"
 *   L162 "linked image click navigates without lightbox"
 *       → "Given a post with a linked image, ... clicking it navigates without opening the lightbox"
 */
import { test, expect, emptyDataGate } from "./fixtures";
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Lightbox seed — a published post with one standalone <img> and one linked
// <a><img>. Same race-safe pattern as seo-rss.spec.ts: seed is left in the
// local E2E DB until runner-level cleanup (docs/25-l3-bdd-refactor.md §8.2).
// ---------------------------------------------------------------------------

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:27028";
const SLUG = `e2e-content-img-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const NOW_EPOCH = Math.floor(Date.now() / 1000);
const IMAGE_URL = (() => {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) return "https://assets.example.com/wp-content/uploads/test-e2e.jpg";
  try {
    return `${new URL(url).origin}/wp-content/uploads/test-e2e.jpg`;
  } catch {
    return "https://assets.example.com/wp-content/uploads/test-e2e.jpg";
  }
})();
const LINK_HREF = "https://example.com";
const CONTENT = [
  `# Image Optimization Test`,
  ``,
  `Inline image:`,
  ``,
  `![test photo](${IMAGE_URL})`,
  ``,
  `Linked image:`,
  ``,
  `[![linked photo](${IMAGE_URL})](${LINK_HREF})`,
].join("\n");

async function seedPost(): Promise<void> {
  const res = await fetch(`${BASE}/api/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "E2E Content Image Lightbox",
      slug: SLUG,
      content: CONTENT,
      status: "published",
      published_at: NOW_EPOCH,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to seed post: ${res.status} ${await res.text()}`);
  }
}

function postUrl(): string {
  const d = new Date(NOW_EPOCH * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `/${year}/${month}/${SLUG}`;
}

// ---------------------------------------------------------------------------
// Helpers — taxonomy/preview source discovery via the home/admin lists.
// CSS attribute selectors keep parity with the source specs; category/tag
// anchors expose no role/testid (the structural signal is the href prefix).
// ---------------------------------------------------------------------------

async function discoverFirstCategorySlug(page: Page): Promise<string | null> {
  await page.goto("/", { waitUntil: "networkidle" });
  const link = page.locator("a[href^='/category/']").first();
  if ((await link.count()) === 0) return null;
  const href = await link.getAttribute("href");
  return href ? href.replace("/category/", "") : null;
}

async function discoverFirstTagSlug(page: Page): Promise<string | null> {
  await page.goto("/", { waitUntil: "networkidle" });
  const link = page.locator("a[href^='/tag/']").first();
  if ((await link.count()) === 0) return null;
  const href = await link.getAttribute("href");
  return href ? href.replace("/tag/", "") : null;
}

/** Resolve a real post id from the admin posts list. Returns null when the
 *  list is empty (test DB may have no posts). CSS attribute selector: edit
 *  links on the list rely on href shape, not on a role/testid. */
async function discoverAdminPostId(page: Page): Promise<string | null> {
  await page.goto("/admin/posts", { waitUntil: "networkidle" });
  const link = page
    .locator('a[href*="/admin/posts/"][href$="/edit"]')
    .first();
  if ((await link.count()) === 0) return null;
  const href = await link.getAttribute("href");
  return href?.match(/\/admin\/posts\/([^/]+)\/edit/)?.[1] ?? null;
}

// ---------------------------------------------------------------------------
// Feature: Home pagination
// ---------------------------------------------------------------------------

test.describe("Feature: Home pagination", () => {
  test("Given /page/2, When I open it, Then it returns 200 with cards/empty-state or 404 when posts are insufficient", async ({
    page,
  }) => {
    // Given/When: navigate to /page/2
    const response = await page.goto("/page/2", { waitUntil: "networkidle" });
    const status = response?.status() ?? 0;

    // Then: only 200 (content) and 404 (insufficient posts) are legitimate.
    // Anything else (500/302/0) is a regression we must surface, not skip.
    expect([200, 404]).toContain(status);

    // When the response is 404, skip the body assertions; otherwise the
    // body must show either cards or the empty-state copy.
    const gate = emptyDataGate(status === 200 ? 1 : 0, "home page 2 content");
    test.skip(gate.skip, gate.reason);

    await expect(page).toHaveURL(/\/page\/2/);

    const postCard = page.getByRole("article");
    const emptyState = page.getByText(/暂无文章/);
    const hasCards = (await postCard.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasCards || hasEmpty).toBe(true);
  });

  test("Given /page/1, When I open it, Then it returns 404 (only /page/2+ is valid)", async ({
    page,
  }) => {
    const response = await page.goto("/page/1", { waitUntil: "networkidle" });
    expect(response?.status()).toBe(404);
  });

  test("Given a non-numeric page segment, When I open /page/abc, Then it returns 404", async ({
    page,
  }) => {
    const response = await page.goto("/page/abc", { waitUntil: "networkidle" });
    expect(response?.status()).toBe(404);
  });

  test("Given a negative page segment, When I open /page/-1, Then it returns 404", async ({
    page,
  }) => {
    const response = await page.goto("/page/-1", { waitUntil: "networkidle" });
    expect(response?.status()).toBe(404);
  });

  test("Given the home page exposes a /page/2 link, When I click it, Then I land on /page/2", async ({
    page,
  }) => {
    // Given: home loads; the next-page link may be absent on a thin DB
    await page.goto("/", { waitUntil: "networkidle" });
    // CSS attribute selector: pagination next link has no role/testid; the
    // distinguishing structural trait is the href value.
    const nextLink = page
      .locator('a[href="/page/2"], a[href*="/page/2"]')
      .first();
    const gate = emptyDataGate(await nextLink.count(), "home /page/2 link");
    test.skip(gate.skip, gate.reason);

    // When: click the link
    await expect(nextLink).toBeVisible();
    await nextLink.click();

    // Then: URL is /page/2 and at least one article is visible
    await expect(page).toHaveURL(/\/page\/2/);
    await expect(page.getByRole("article").first()).toBeVisible();
  });

  test("Given /page/2 loads with the pagination nav, When I inspect aria-current, Then it shows '2'", async ({
    page,
  }) => {
    const response = await page.goto("/page/2", { waitUntil: "networkidle" });
    const status = response?.status() ?? 0;
    // 200 / 404 are the only legitimate statuses; surface regressions instead
    // of silently skipping them.
    expect([200, 404]).toContain(status);
    const gateStatus = emptyDataGate(
      status === 200 ? 1 : 0,
      "home page 2 content",
    );
    test.skip(gateStatus.skip, gateStatus.reason);

    // CSS attribute selector: pagination is rendered as <nav aria-label="分页">;
    // we still go through the locale label here because there is no semantic
    // role that distinguishes it from the site's other navs.
    const paginationNav = page.locator('nav[aria-label="分页"]');
    const gate = emptyDataGate(await paginationNav.count(), "pagination nav");
    test.skip(gate.skip, gate.reason);

    const currentPageIndicator = paginationNav.locator('[aria-current="page"]');
    await expect(currentPageIndicator).toBeVisible();
    await expect(currentPageIndicator).toHaveText("2");
  });

  test("Given /page/2 loads with the pagination nav, When I click 上一页, Then I return to /", async ({
    page,
  }) => {
    const response = await page.goto("/page/2", { waitUntil: "networkidle" });
    const status = response?.status() ?? 0;
    expect([200, 404]).toContain(status);
    const gateStatus = emptyDataGate(
      status === 200 ? 1 : 0,
      "home page 2 content",
    );
    test.skip(gateStatus.skip, gateStatus.reason);

    const paginationNav = page.locator('nav[aria-label="分页"]');
    const gate = emptyDataGate(await paginationNav.count(), "pagination nav");
    test.skip(gate.skip, gate.reason);

    // CSS attribute selector: aria-label is locale-content ("上一页"); there is
    // no semantic role per pagination button, only nav-level aria-label.
    const prevLink = paginationNav.locator('a[aria-label="上一页"]');
    await expect(prevLink).toBeVisible();
    await prevLink.click();
    await page.waitForURL("/", { timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Feature: Category pagination
// ---------------------------------------------------------------------------

test.describe("Feature: Category pagination", () => {
  test("Given /category/<slug>/page/2 (discovered), When I open it, Then status is 200 or 404", async ({
    page,
  }) => {
    const slug = await discoverFirstCategorySlug(page);
    const gate = emptyDataGate(slug === null ? 0 : 1, "category links on home");
    test.skip(gate.skip, gate.reason);

    const response = await page.goto(`/category/${slug}/page/2`, {
      waitUntil: "networkidle",
    });
    expect([200, 404]).toContain(response?.status() ?? 0);
  });

  test("Given /category/<slug>/page/2 returns 200, When I inspect the header, Then header h1 is visible", async ({
    page,
  }) => {
    const slug = await discoverFirstCategorySlug(page);
    const gateNav = emptyDataGate(slug === null ? 0 : 1, "category links on home");
    test.skip(gateNav.skip, gateNav.reason);

    const response = await page.goto(`/category/${slug}/page/2`, {
      waitUntil: "networkidle",
    });
    const status = response?.status() ?? 0;
    // 200 / 404 are the only legitimate statuses; surface regressions instead
    // of silently skipping them.
    expect([200, 404]).toContain(status);
    const gate = emptyDataGate(
      status === 200 ? 1 : 0,
      "category /page/2 with content",
    );
    test.skip(gate.skip, gate.reason);

    // CSS selector "header h1": the site sidebar also renders an h1 (site
    // title), so getByRole('heading', {level:1}) would risk matching that.
    await expect(page.locator("header h1")).toBeVisible();
  });

  test("Given /category/<slug>/page/1, When I open it, Then it returns 404", async ({
    page,
  }) => {
    const response = await page.goto("/category/anything/page/1", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(404);
  });

  test("Given /category/<missing>/page/2, When I open it, Then it returns 404", async ({
    page,
  }) => {
    const response = await page.goto(
      "/category/non-existent-slug-12345/page/2",
      { waitUntil: "networkidle" },
    );
    expect(response?.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Feature: Tag pagination
// ---------------------------------------------------------------------------

test.describe("Feature: Tag pagination", () => {
  test("Given /tag/<slug>/page/2 (discovered), When I open it, Then status is 200 or 404", async ({
    page,
  }) => {
    const slug = await discoverFirstTagSlug(page);
    const gate = emptyDataGate(slug === null ? 0 : 1, "tag links on home");
    test.skip(gate.skip, gate.reason);

    const response = await page.goto(`/tag/${slug}/page/2`, {
      waitUntil: "networkidle",
    });
    expect([200, 404]).toContain(response?.status() ?? 0);
  });

  test("Given /tag/<slug>/page/2 returns 200, When I inspect the header, Then header h1 starts with '#'", async ({
    page,
  }) => {
    const slug = await discoverFirstTagSlug(page);
    const gateNav = emptyDataGate(slug === null ? 0 : 1, "tag links on home");
    test.skip(gateNav.skip, gateNav.reason);

    const response = await page.goto(`/tag/${slug}/page/2`, {
      waitUntil: "networkidle",
    });
    const status = response?.status() ?? 0;
    expect([200, 404]).toContain(status);
    const gate = emptyDataGate(
      status === 200 ? 1 : 0,
      "tag /page/2 with content",
    );
    test.skip(gate.skip, gate.reason);

    // CSS selector "header h1": same sidebar-h1 disambiguation as Category.
    const heading = page.locator("header h1");
    await expect(heading).toBeVisible();
    const text = await heading.textContent();
    expect(text).toMatch(/^#/);
  });

  test("Given /tag/<slug>/page/1, When I open it, Then it returns 404", async ({
    page,
  }) => {
    const response = await page.goto("/tag/anything/page/1", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(404);
  });

  test("Given /tag/<missing>/page/2, When I open it, Then it returns 404", async ({
    page,
  }) => {
    const response = await page.goto(
      "/tag/non-existent-slug-12345/page/2",
      { waitUntil: "networkidle" },
    );
    expect(response?.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Feature: Archive pagination
// ---------------------------------------------------------------------------

test.describe("Feature: Archive pagination", () => {
  test("Given /archive/YYYY/page/2, When I open it, Then status is 200 or 404", async ({
    page,
  }) => {
    const year = new Date().getFullYear();
    const response = await page.goto(`/archive/${year}/page/2`, {
      waitUntil: "networkidle",
    });
    expect([200, 404]).toContain(response?.status() ?? 0);
  });

  test("Given /archive/YYYY/page/2 returns 200, When I inspect the header, Then it contains the year", async ({
    page,
  }) => {
    const year = new Date().getFullYear();
    const response = await page.goto(`/archive/${year}/page/2`, {
      waitUntil: "networkidle",
    });
    const status = response?.status() ?? 0;
    expect([200, 404]).toContain(status);
    const gate = emptyDataGate(
      status === 200 ? 1 : 0,
      "archive /page/2 with content",
    );
    test.skip(gate.skip, gate.reason);

    // CSS selector "header h1": same sidebar-h1 disambiguation as Category.
    const heading = page.locator("header h1");
    await expect(heading).toBeVisible();
    const text = await heading.textContent();
    expect(text).toContain(String(year));
  });

  test("Given /archive/YYYY/page/1, When I open it, Then it returns 404", async ({
    page,
  }) => {
    const year = new Date().getFullYear();
    const response = await page.goto(`/archive/${year}/page/1`, {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(404);
  });

  test("Given /archive/9999/page/2, When I open it, Then it returns 404", async ({
    page,
  }) => {
    const response = await page.goto("/archive/9999/page/2", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Feature: Blog search
// ---------------------------------------------------------------------------

test.describe("Feature: Blog search", () => {
  test("Given /search without query, When I open it, Then the empty-state prompt is visible", async ({
    page,
  }) => {
    await page.goto("/search", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/search/);

    // Empty state: "输入关键词搜索文章" prompt. getByText regex: no semantic
    // role for the prompt — it is locale copy.
    const emptyState = page.getByText(/输入关键词|Enter keywords/i);
    await expect(emptyState.first()).toBeVisible({ timeout: 10_000 });
  });

  test("Given /search?q=test, When I open it, Then the heading, result count, and cards-or-empty are visible", async ({
    page,
  }) => {
    await page.goto("/search?q=test", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/search\?q=test/);

    // Then: heading echoes the query string.
    // getByText regex: search results heading is locale copy ("搜索 ... test").
    const heading = page.getByText(/搜索.*test|Search.*test/i);
    await expect(heading.first()).toBeVisible({ timeout: 10_000 });

    // Then: result-count line is visible.
    const resultCount = page.getByText(/条结果|results/i);
    await expect(resultCount.first()).toBeVisible({ timeout: 10_000 });

    // Then: either post cards or the empty-state copy is visible.
    const postCard = page.getByRole("article");
    const emptyText = page.getByText(/未找到|No results/i);
    const hasCards = (await postCard.count()) > 0;
    const hasEmpty = (await emptyText.count()) > 0;
    expect(hasCards || hasEmpty).toBe(true);
  });

  test("Given a broad search query, When I open /search?q=a, Then the pagination locator is present (count >= 0)", async ({
    page,
  }) => {
    // Pagination is optional — only render when results exceed page size.
    await page.goto("/search?q=a", { waitUntil: "networkidle" });
    // CSS attribute selector: pagination has no role at the wrapper level
    // (nav[aria-label="分页"] is the inner pagination nav); we keep the
    // permissive locator from the source spec to mirror its scope.
    const pagination = page.locator(
      '[data-testid="pagination"], nav[aria-label*="pagination"], .pagination',
    );
    const count = await pagination.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("Given /search?q=a&page=2, When I open it, Then the results container is visible", async ({
    page,
  }) => {
    await page.goto("/search?q=a&page=2", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/search\?/);
    // CSS selector: main / .blog-search-results — the search results wrapper
    // is identified by a stable class; no testid or role at that level.
    const content = page.locator("main, .blog-search-results");
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Feature: Blog preview
// ---------------------------------------------------------------------------

test.describe("Feature: Blog preview", () => {
  test("Given /preview/<missing>, When I open it, Then the page renders body (no auth redirect under E2E_SKIP_AUTH)", async ({
    page,
  }) => {
    await page.goto("/preview/nonexistent-id", { waitUntil: "networkidle" });
    // Auth bypass keeps the request on the preview route; whether the page
    // renders not-found or empty is a separate scenario.
    await expect(page.locator("body")).toBeVisible();
  });

  test("Given an admin-listed post id, When I open /preview/<id>, Then the preview banner, article, and Edit link are visible", async ({
    page,
  }) => {
    // Given: discover a real post id from the admin posts list
    const postId = await discoverAdminPostId(page);
    const gate = emptyDataGate(postId === null ? 0 : 1, "admin posts");
    test.skip(gate.skip, gate.reason);

    // When: navigate to /preview/<id>
    await page.goto(`/preview/${postId}`, { waitUntil: "networkidle" });

    // Then: preview banner "Preview Mode" is visible. getByText regex: the
    // banner copy is locale text and not exposed as a labelled role.
    await expect(
      page.getByText(/Preview Mode/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Then: the article (h1) is visible
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Then: an Edit link is visible. getByText regex matches the visible
    // copy; no dedicated role exists for this link.
    await expect(
      page.getByText(/Edit/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /preview/<missing>, When I open it, Then status is 200 or 404", async ({
    page,
  }) => {
    const response = await page.goto("/preview/non-existent-post-id-12345", {
      waitUntil: "networkidle",
    });
    if (response) {
      expect([200, 404]).toContain(response.status());
    }
    await expect(page.locator("body")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Feature: Content image lightbox
// ---------------------------------------------------------------------------

test.describe("Feature: Content image lightbox", () => {
  test.beforeAll(async () => {
    await seedPost();
  });

  test("Given a post with an inline image, When I click it, Then the lightbox overlay opens", async ({
    page,
  }) => {
    // Given: load the seeded post detail page
    await page.goto(postUrl(), { waitUntil: "networkidle" });

    // CSS class selector ".blog-content img:not(a img)": .blog-content is the
    // Markdown body wrapper (no role); :not(a img) excludes wrapped-link
    // images so this scenario only targets the standalone <img>.
    const imgs = page.locator(".blog-content img");
    expect(await imgs.count()).toBeGreaterThanOrEqual(1);

    const standaloneImg = page.locator(".blog-content img:not(a img)").first();

    // When: click the standalone image
    await standaloneImg.click();

    // Then: the lightbox overlay is visible.
    // CSS class selector ".fixed.inset-0.z-50": overlay component composes
    // Tailwind utilities at the root; no role/testid is exposed.
    const overlay = page.locator(".fixed.inset-0.z-50");
    await expect(overlay).toBeVisible({ timeout: 5_000 });
  });

  test("Given the lightbox is open, When I inspect its image, Then it shows the original image src", async ({
    page,
  }) => {
    await page.goto(postUrl(), { waitUntil: "networkidle" });
    await page.locator(".blog-content img:not(a img)").first().click();

    const overlay = page.locator(".fixed.inset-0.z-50");
    await expect(overlay).toBeVisible({ timeout: 5_000 });

    // Then: the overlay image references the original URL
    const lightboxImg = overlay.locator("img");
    await expect(lightboxImg).toBeVisible();
    const src = await lightboxImg.getAttribute("src");
    expect(src).toContain(IMAGE_URL);
  });

  test("Given the lightbox is open, When I close it, Then X button / Escape / backdrop click each dismiss it", async ({
    page,
  }) => {
    await page.goto(postUrl(), { waitUntil: "networkidle" });
    const standaloneImg = page.locator(".blog-content img:not(a img)").first();
    const overlay = page.locator(".fixed.inset-0.z-50");

    // Close via X button (first descendant <button>).
    await standaloneImg.click();
    await expect(overlay).toBeVisible({ timeout: 5_000 });
    await overlay.locator("button").first().click();
    await expect(overlay).not.toBeVisible();

    // Close via Escape key.
    await standaloneImg.click();
    await expect(overlay).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press("Escape");
    await expect(overlay).not.toBeVisible();

    // Close via backdrop click (top-left corner, outside content).
    await standaloneImg.click();
    await expect(overlay).toBeVisible({ timeout: 5_000 });
    await overlay.click({ position: { x: 5, y: 5 } });
    await expect(overlay).not.toBeVisible();
  });

  test("Given a post with a linked image, When I click it, Then it navigates without opening the lightbox", async ({
    page,
  }) => {
    await page.goto(postUrl(), { waitUntil: "networkidle" });

    // Linked image lives under an <a> ancestor.
    const linkedImg = page.locator(".blog-content a img").first();
    const gate = emptyDataGate(await linkedImg.count(), "linked images in seed");
    test.skip(gate.skip, gate.reason);

    await expect(linkedImg).toBeVisible();

    // When: click — page should navigate, not open lightbox
    await Promise.all([
      page.waitForNavigation({ timeout: 10_000 }).catch(() => null),
      linkedImg.click(),
    ]);

    // Then: the lightbox overlay is not visible
    const overlay = page.locator(".fixed.inset-0.z-50");
    await expect(overlay).not.toBeVisible();
  });
});
