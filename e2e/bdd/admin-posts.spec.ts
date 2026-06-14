/**
 * L3 BDD: Admin posts list + new editor + edit page.
 *
 * Phase 3.4 of L3 → BDD migration (see docs/25-l3-bdd-refactor.md §3, §4.2).
 *
 * Source spec attribution (8 + 7 = 15 → 15 scenarios, no merges):
 *   - browser/admin-posts.spec.ts (8 tests across 2 describes; dashboard +
 *     analytics subset already migrated in Phase 2.2 — see Phase 2.2
 *     `bdd/admin-dashboard.spec.ts`; remaining 8 list/new-editor tests
 *     migrated in this commit)
 *   - browser/admin-post-edit.spec.ts (7 tests in 1 describe, all migrated)
 *
 * Mapping (old test → new scenario):
 *
 * --- Admin posts list (4 → 4) ---
 *   admin-posts "posts list page loads"
 *       → "Given /admin/posts is requested, ... the AdminShell h1 (文章) is visible"
 *   admin-posts "posts list shows table or grid of posts"
 *       → "Given /admin/posts renders in list mode, ... the <table> is visible
 *          and per-state surfaces 未找到文章 (empty) OR the first 编辑 row link"
 *   admin-posts "has new post button"
 *       → "Given /admin/posts renders, ... the 新建文章 link to /admin/posts/new
 *          is visible"
 *   admin-posts "clicking new post navigates to editor"
 *       → "Given /admin/posts renders, When I click 新建文章, Then pathname is
 *          exactly /admin/posts/new"
 *
 * --- Admin post new editor (4 → 4) ---
 *   admin-posts "new post page loads with editor form"
 *       → "Given /admin/posts/new is requested, ... the AdminShell h1 (文章)
 *          and 文章标题 placeholder input are visible"
 *   admin-posts "editor has content area"
 *       → "Given /admin/posts/new renders, ... at least one content textarea
 *          (#content-mobile or #content-desktop) is attached"
 *   admin-posts "editor has publish/save buttons"
 *       → "Given /admin/posts/new renders, ... within the <form> the 创建文章
 *          submit + 取消 buttons are visible AND 删除文章 has 0 count (new
 *          mode never exposes delete)"
 *   admin-posts "can enter title in editor"
 *       → "Given /admin/posts/new renders, When I fill a unique-prefixed title,
 *          Then the title input has that exact value (slug auto-sync to the
 *          slugified title is asserted as an additional contract, not in the
 *          source test)"
 *
 * --- Admin post edit page (7 → 7) ---
 *   admin-post-edit "edit page loads from admin posts list"
 *       → "Given /admin/posts has at least one post, When I click the first
 *          row's 编辑 link, Then pathname matches /admin/posts/<id>/edit
 *          with a non-empty uuid segment; test.skip on empty seed"
 *   admin-post-edit "edit form pre-fills the title input"
 *       → "Given an existing post edit page renders, ... the 文章标题 input
 *          has a non-empty value"
 *   admin-post-edit "edit form exposes the markdown content editor"
 *       → "Given an existing post edit page renders, ... at least one
 *          content textarea (#content-mobile or #content-desktop) is attached"
 *   admin-post-edit "edit form exposes category and status selects plus tag controls"
 *       → "Given an existing post edit page renders, ... select#status and
 *          select#category are visible AND the 标签 <label> is visible
 *          (scoped to <label> to avoid sidebar nav span collision)"
 *   admin-post-edit "edit form has update and delete actions"
 *       → "Given an existing post edit page renders, ... within the <form>
 *          the 更新文章 submit + 删除文章 buttons are visible"
 *   admin-post-edit "cancel button navigates back to the posts list"
 *       → "Given an existing post edit page renders, When I click 取消,
 *          Then pathname is exactly /admin/posts"
 *   admin-post-edit "non-existent post ID returns 404"
 *       → "Given a nil-uuid edit URL is requested, ... the HTTP response
 *          status is exactly 404"
 *
 * Reviewer pins (msg=45d79317) honored:
 *   1. All list/table/edit-helper scenarios force list view mode via
 *      addInitScript so AdminPostsClient's localStorage-driven view mode
 *      cannot leak grid mode in from a prior run.
 *   2. List shows-state scenario scopes 未找到文章 to the <table>; non-empty
 *      branch asserts first 编辑 link inside the table.
 *   3. gotoFirstPostEdit returns null on empty seed; each caller does explicit
 *      test.skip with a reason (no silent return); pathname structural assert
 *      checks both "/admin/posts/" prefix + "/edit" suffix + non-empty uuid.
 *   4. can-enter-title scenario primary assertion is titleInput.toHaveValue;
 *      slug auto-sync is an additional contract documented in the mapping
 *      above. Slug uses page.getByPlaceholder("url-slug") + toHaveValue, no
 *      fixed timeout fallback.
 *   5. Content editor scenarios use isAttached, NOT isVisible — mobile and
 *      desktop textareas both mount; one is hidden via Tailwind responsive
 *      utilities (post-form-content-editor.tsx:152-206).
 *   6. New-editor action area scoped to <form>; 删除文章 reverse-asserted at 0
 *      count inside the form to catch any future regression that surfaces
 *      delete in new mode.
 *   7. Edit category/status/tag scenario uses select#status / select#category
 *      hard-asserts and the 标签 <label> locator (post-form-fields.tsx:183)
 *      to avoid the sidebar's <span>标签</span>.
 *   8. Commit body spells out source split (admin-posts.spec.ts had 8 left
 *      after Phase 2.2 dashboard/analytics migration) + deletes both source
 *      specs in the same commit + includes all 15 old → new mappings.
 */
import type { Page } from "@playwright/test";
import { test, expect, expectPathname } from "./fixtures";

// ---------------------------------------------------------------------------
// Local helpers — list-mode entry + edit-page helper.
// ---------------------------------------------------------------------------

/**
 * Force the admin posts list into the "list" view mode before any navigation.
 * AdminPostsClient stores the view-mode preference in
 * localStorage["firefly_posts_view_mode"]; if it leaks "grid" from a prior
 * run or browser state, the <table>-based list view never mounts and all
 * table-scoped assertions break. Pre-injecting list here is the stable fix.
 * (See src/components/admin/admin-posts-client.tsx:19, L113-117, L178-196.)
 */
async function gotoAdminPostsList(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("firefly_posts_view_mode", "list");
  });
  await page.goto("/admin/posts", { waitUntil: "networkidle" });
  await expectPathname(page, "/admin/posts");
}

/**
 * Navigate from the admin posts list to the first post's edit page.
 * Returns the post uuid on success or null when the seed has no posts.
 * Mirrors the original gotoFirstPostEdit pattern but never silently returns:
 * callers must pair `null` with `test.skip(postId === null, "reason")`.
 */
async function gotoFirstPostEdit(page: Page): Promise<string | null> {
  await gotoAdminPostsList(page);

  // PostRow renders an <a href={`/admin/posts/${post.id}/edit`}> per row
  // (admin-posts-list-view.tsx:87). Scope to the <table> so future page-level
  // edit links elsewhere cannot satisfy this selector.
  const table = page.getByRole("table");
  const editLink = table.locator('a[href*="/admin/posts/"][href$="/edit"]').first();
  if ((await editLink.count()) === 0) return null;

  const href = await editLink.getAttribute("href");
  const match = href?.match(/\/admin\/posts\/([^/]+)\/edit/);
  if (!match) return null;

  await editLink.click();
  await page.waitForURL(/\/admin\/posts\/[^/]+\/edit/, { timeout: 10_000 });
  return match[1] ?? null;
}

// ---------------------------------------------------------------------------
// Feature: Admin posts list
// ---------------------------------------------------------------------------

test.describe("Feature: Admin posts list", () => {
  test("Given /admin/posts is requested, When I open it, Then the AdminShell h1 (文章) is visible", async ({
    page,
  }) => {
    // Given/When: open the posts list page in list-view mode.
    await gotoAdminPostsList(page);

    // Then: AdminShell h1 — i18n key "admin.page.posts" → "文章"
    // (src/lib/i18n/index.ts:35). exact:true avoids substring collision with
    // other 文章-prefixed headings (e.g. 文章数).
    await expect(
      page.getByRole("heading", { level: 1, name: "文章", exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/posts renders in list mode, When I view the list, Then the <table> is visible and per-state surfaces 未找到文章 (empty) OR the first 编辑 row link (non-empty)", async ({
    page,
  }) => {
    // Given/When: open the posts list page in list-view mode.
    await gotoAdminPostsList(page);

    // Then: admin-posts-list-view.tsx:198 always renders <table>; empty branch
    // fills <tbody> with a single colSpan=9 row containing "未找到文章"
    // (L210-213); non-empty branch fills PostRow cells with an 编辑 link.
    const table = page.getByRole("table");
    await expect(table).toBeVisible({ timeout: 10_000 });

    // Then: state branch — empty branch asserts the exact 未找到文章 copy
    // scoped to <table>; non-empty branch asserts the first row 编辑 link.
    // PostRowActions renders the edit link with text "编辑" + Pencil icon
    // (admin-posts-list-view.tsx:86-92). Filter to links so the table-header
    // 编辑 sortable column (if any future regression) cannot satisfy.
    const editLinks = table.getByRole("link", { name: /编辑/ });
    const editCount = await editLinks.count();
    if (editCount === 0) {
      await expect(
        table.getByText("未找到文章", { exact: true }),
      ).toBeVisible();
    } else {
      await expect(editLinks.first()).toBeVisible();
    }
  });

  test("Given /admin/posts renders, When I view the header actions, Then the 新建文章 link to /admin/posts/new is visible", async ({
    page,
  }) => {
    // Given/When: open the posts list page in list-view mode.
    await gotoAdminPostsList(page);

    // Then: admin-posts-client.tsx:161-166 renders a Next.js <Link> with text
    // "新建文章" and href="/admin/posts/new". Use getByRole("link") with
    // exact:true so substring matches do not satisfy.
    const newLink = page.getByRole("link", { name: "新建文章", exact: true });
    await expect(newLink).toBeVisible({ timeout: 10_000 });
    await expect(newLink).toHaveAttribute("href", "/admin/posts/new");
  });

  test("Given /admin/posts renders, When I click 新建文章, Then pathname is exactly /admin/posts/new", async ({
    page,
  }) => {
    // Given: open the posts list page in list-view mode.
    await gotoAdminPostsList(page);

    // When: click the 新建文章 link.
    await page
      .getByRole("link", { name: "新建文章", exact: true })
      .click();
    // Then: pathname is exactly /admin/posts/new.
    await page.waitForURL("**/admin/posts/new", { timeout: 10_000 });
    await expectPathname(page, "/admin/posts/new");
  });
});

// ---------------------------------------------------------------------------
// Feature: Admin post new editor
// ---------------------------------------------------------------------------

test.describe("Feature: Admin post new editor", () => {
  test("Given /admin/posts/new is requested, When I open it, Then the AdminShell h1 (文章) and 文章标题 placeholder input are visible", async ({
    page,
  }) => {
    // Given/When: open the new post editor.
    await page.goto("/admin/posts/new", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/posts/new");

    // Then: /admin/posts/new is wrapped by the admin layout, so the
    // AdminShell h1 stays "文章" (page.subtitle changes via
    // PageSubtitleContext but h1 does not). exact:true to avoid 文章-prefix
    // substring matches.
    await expect(
      page.getByRole("heading", { level: 1, name: "文章", exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    // Then: post-form.tsx:273 — title <Input> placeholder is exactly "文章标题".
    await expect(
      page.getByPlaceholder("文章标题"),
    ).toBeVisible();
  });

  test("Given /admin/posts/new renders, When I view the editor, Then at least one content textarea (#content-mobile or #content-desktop) is attached", async ({
    page,
  }) => {
    // Given/When: open the new post editor.
    await page.goto("/admin/posts/new", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/posts/new");

    // Then: post-form-content-editor.tsx mounts BOTH textareas simultaneously
    // — L171-181 mobile (#content-mobile) and L194-205 desktop
    // (#content-desktop); Tailwind responsive utilities hide one via
    // display:none. isAttached (not isVisible) is the correct check.
    const contentArea = page.locator(
      "textarea#content-mobile, textarea#content-desktop",
    );
    expect(await contentArea.count()).toBeGreaterThan(0);
    await expect(contentArea.first()).toBeAttached();
  });

  test("Given /admin/posts/new renders, When I view the form action area, Then 创建文章 + 取消 are visible inside the form AND 删除文章 has 0 count (new mode never exposes delete)", async ({
    page,
  }) => {
    // Given/When: open the new post editor.
    await page.goto("/admin/posts/new", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/posts/new");

    // Then: post-form.tsx:386-391 wraps editorFields (including action area)
    // in <form>. Scope to it so unrelated page-level buttons cannot satisfy.
    const form = page.locator("form");
    await expect(
      form.getByRole("button", { name: "创建文章", exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      form.getByRole("button", { name: "取消", exact: true }),
    ).toBeVisible();

    // Then: post-form.tsx:357-367 — the {isEditing && ...} branch renders
    // 删除文章. In new mode (post=undefined) that button must never appear
    // inside the form. Reverse-assert count to guard against a future
    // regression that accidentally surfaces delete in new mode.
    await expect(
      form.getByRole("button", { name: "删除文章" }),
    ).toHaveCount(0);
  });

  test("Given /admin/posts/new renders, When I fill a unique-prefixed title, Then the title input has that value AND the slug input is auto-synced to the slugified value", async ({
    page,
  }) => {
    // Given: open the new post editor.
    await page.goto("/admin/posts/new", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/posts/new");

    // Given: unique prefix avoids cross-run pollution; we never submit, so no
    // DB write happens — the value is verified entirely client-side.
    const ts = Date.now();
    const uniqueTitle = `E2E Admin Posts ${ts} Test`;
    const expectedSlug = `e2e-admin-posts-${ts}-test`;

    // When: fill the title input with the unique-prefixed value.
    const titleInput = page.getByPlaceholder("文章标题");
    await titleInput.fill(uniqueTitle);

    // Then: primary contract from the original test — title input must hold
    // the exact value the user typed.
    await expect(titleInput).toHaveValue(uniqueTitle);

    // Then: additional contract (documented in commit body / mapping) — in
    // new mode, post-form.tsx:152-158 auto-syncs slug from slugify(title) as
    // long as the slug field has not been manually edited. toHaveValue polls
    // until the React state propagates — no fixed timeout fallback.
    await expect(
      page.getByPlaceholder("url-slug"),
    ).toHaveValue(expectedSlug);
  });
});

// ---------------------------------------------------------------------------
// Feature: Admin post edit page
// ---------------------------------------------------------------------------

test.describe("Feature: Admin post edit page", () => {
  test("Given /admin/posts has at least one post, When I click the first row's 编辑 link, Then pathname matches /admin/posts/<id>/edit with a non-empty uuid segment", async ({
    page,
  }) => {
    // Given: navigate from the posts list to the first row's edit page.
    const postId = await gotoFirstPostEdit(page);
    // Then: empty branch skips with explicit reason; non-empty branch
    // proceeds to assert the structural pathname.
    test.skip(
      postId === null,
      "No posts available in seed to drive edit-page entry scenario.",
    );

    // Then: structural assertion — pathname cannot be a single literal here,
    // so pin the prefix + suffix + non-empty uuid segment instead of a regex
    // match on page.url(). This matches the path-level guard discipline used
    // elsewhere in the BDD suite.
    const { pathname } = new URL(page.url());
    expect(pathname.startsWith("/admin/posts/")).toBe(true);
    expect(pathname.endsWith("/edit")).toBe(true);
    const segment = pathname.slice("/admin/posts/".length, -"/edit".length);
    expect(segment.length).toBeGreaterThan(0);
    // Then: sanity — returned helper id matches the URL segment.
    expect(segment).toBe(postId);
  });

  test("Given an existing post edit page renders, When I view the title field, Then 文章标题 input has a non-empty value", async ({
    page,
  }) => {
    // Given: navigate from the posts list to the first row's edit page.
    const postId = await gotoFirstPostEdit(page);
    // Then: empty branch skips with explicit reason; non-empty branch
    // proceeds to assert the title pre-fill.
    test.skip(
      postId === null,
      "No posts available in seed to drive edit-form prefill scenario.",
    );

    // When/Then: read the 文章标题 input and assert it hydrated to a
    // non-empty existing value.
    const titleInput = page.getByPlaceholder("文章标题");
    await expect(titleInput).toBeVisible({ timeout: 10_000 });
    const value = await titleInput.inputValue();
    expect(
      value.length,
      "edit form must hydrate 文章标题 with the existing post title",
    ).toBeGreaterThan(0);
  });

  test("Given an existing post edit page renders, When I view the content editor, Then at least one content textarea (#content-mobile or #content-desktop) is attached", async ({
    page,
  }) => {
    // Given: navigate from the posts list to the first row's edit page.
    const postId = await gotoFirstPostEdit(page);
    // Then: empty branch skips with explicit reason; non-empty branch
    // proceeds to assert the content textarea presence.
    test.skip(
      postId === null,
      "No posts available in seed to drive edit-form content-editor scenario.",
    );

    // Then: same responsive dual-mount pattern as the new editor —
    // isAttached, not isVisible. post-form-content-editor.tsx:171-205.
    const contentArea = page.locator(
      "textarea#content-mobile, textarea#content-desktop",
    );
    expect(await contentArea.count()).toBeGreaterThan(0);
    await expect(contentArea.first()).toBeAttached();
  });

  test("Given an existing post edit page renders, When I view the status/category/tag controls, Then select#status, select#category, and the 标签 label are visible", async ({
    page,
  }) => {
    // Given: navigate from the posts list to the first row's edit page.
    const postId = await gotoFirstPostEdit(page);
    // Then: empty branch skips with explicit reason; non-empty branch
    // proceeds to assert the status/category/tag controls.
    test.skip(
      postId === null,
      "No posts available in seed to drive edit-form status/category/tag scenario.",
    );

    // Then: post-form-fields.tsx PostStatusCategoryRow renders
    // <Select id="status"> (L102-111) and <Select id="category"> (L118-129).
    // CSS selectors are the stable signature — Select wraps a native <select>.
    await expect(page.locator("select#status")).toBeVisible();
    await expect(page.locator("select#category")).toBeVisible();

    // Then: PostTagsField renders <label>标签</label> at L183. The admin
    // sidebar also surfaces "标签" as a <span> nav item; scoping to <label>
    // avoids that collision.
    await expect(
      page.locator("label", { hasText: "标签" }).first(),
    ).toBeVisible();
  });

  test("Given an existing post edit page renders, When I view the form action area, Then 更新文章 (submit) and 删除文章 are visible inside the form", async ({
    page,
  }) => {
    // Given: navigate from the posts list to the first row's edit page.
    const postId = await gotoFirstPostEdit(page);
    // Then: empty branch skips with explicit reason; non-empty branch
    // proceeds to assert the edit-mode action buttons.
    test.skip(
      postId === null,
      "No posts available in seed to drive edit-form actions scenario.",
    );

    // Then: scope to <form>; in edit mode the {isEditing && ...} branch
    // (post-form.tsx:357-367) renders 删除文章 with `ml-auto`.
    const form = page.locator("form");
    await expect(
      form.getByRole("button", { name: "更新文章", exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      form.getByRole("button", { name: "删除文章", exact: true }),
    ).toBeVisible();
  });

  test("Given an existing post edit page renders, When I click 取消, Then pathname is exactly /admin/posts", async ({
    page,
  }) => {
    // Given: navigate from the posts list to the first row's edit page.
    const postId = await gotoFirstPostEdit(page);
    // Then: empty branch skips with explicit reason; non-empty branch
    // proceeds to drive the 取消 navigation.
    test.skip(
      postId === null,
      "No posts available in seed to drive edit-form cancel scenario.",
    );

    // When: click 取消 inside the form — post-form.tsx:350-356 is a
    // <button type="button"> that calls router.push("/admin/posts"). Scope
    // to <form> so other 取消 buttons (e.g. ConfirmDialog cancel) cannot
    // satisfy.
    const form = page.locator("form");
    await form.getByRole("button", { name: "取消", exact: true }).click();
    // Then: pathname becomes exactly /admin/posts.
    await page.waitForURL("**/admin/posts", { timeout: 10_000 });
    await expectPathname(page, "/admin/posts");
  });

  test("Given a nil-uuid edit URL is requested, When I open it, Then the HTTP response status is exactly 404", async ({
    page,
  }) => {
    // Given/When: request a nil-uuid edit URL. src/app/admin/posts/[id]/edit/
    // page.tsx:30 calls notFound() when getPostById returns null. The nil
    // uuid 00000000-... never matches a real post by construction.
    const response = await page.goto(
      "/admin/posts/00000000-0000-0000-0000-000000000000/edit",
      { waitUntil: "networkidle" },
    );
    // Then: response status is exactly 404.
    expect(response?.status()).toBe(404);
  });
});
