/**
 * L3 BDD: Admin categories and tags management.
 *
 * Phase 3.1 of L3 → BDD migration (see docs/25-l3-bdd-refactor.md §3, §4.2).
 *
 * Source spec attribution (9 → 9 scenarios, no merges):
 *   - browser/admin-taxonomy.spec.ts (9 tests across 2 describes)
 *
 * Mapping (old test → new scenario):
 *
 * --- Admin categories page (5 → 5) ---
 *   "Admin categories page > categories page loads"
 *       → "Given /admin/categories is requested, ... the AdminShell h1 (分类) is visible"
 *   "Admin categories page > shows list of categories"
 *       → "Given /admin/categories renders, ... the table is visible; empty branch surfaces 暂无分类, non-empty branch surfaces the first 编辑 row action"
 *   "Admin categories page > clicking create button opens inline form"
 *       → "Given /admin/categories renders, When I click 新建分类, Then the inline form h3 (新建分类), the 名称 and 别名 inputs are visible; clicking 取消 collapses the form (h3 hidden)"
 *   "Admin categories page > clicking edit button opens edit form for category"
 *       → "Given /admin/categories renders with at least one category, When I click the first 编辑, Then the inline form h3 (编辑分类) is visible, the 名称 input has a non-empty value, and clicking 取消 collapses the form (h3 hidden); skip with explicit reason when seed has no categories"
 *   "Admin categories page > category table shows post count column"
 *       → "Given /admin/categories renders, ... the 文章数 column header is visible (scoped to <thead>)"
 *
 * --- Admin tags page (4 → 4) ---
 *   "Admin tags page > tags page loads"
 *       → "Given /admin/tags is requested, ... the AdminShell h1 (标签) is visible"
 *   "Admin tags page > shows list of tags"
 *       → "Given /admin/tags renders, ... the table is visible; empty branch surfaces 暂无标签, non-empty branch surfaces the first 编辑 row action"
 *   "Admin tags page > clicking create button opens inline form"
 *       → "Given /admin/tags renders, When I click 新建标签, Then the inline form h3 (新建标签), the 名称, 别名, and 描述（可选） inputs are visible; clicking 取消 collapses the form (h3 hidden)"
 *   "Admin tags page > clicking edit button opens edit form for tag"
 *       → "Given /admin/tags renders with at least one tag, When I click the first 编辑, Then the inline form h3 (编辑标签) is visible, the 名称 input has a non-empty value, and clicking 取消 collapses the form (h3 hidden); skip with explicit reason when seed has no tags"
 *
 * Reviewer pins (msg=2ec75fdd) honored:
 *   1. shows-list scenarios positively assert table first, then per-state:
 *      empty → exact 暂无... in <table>; non-empty → 编辑 row button visible.
 *      Never count-only.
 *   2. Empty-state copy scoped to the <table> via getByRole("table") to
 *      prevent unrelated future empty-states from satisfying.
 *   3. Edit scenarios use explicit test.skip when no rows exist (no silent
 *      early return). Form h3 + 名称 input value asserted.
 *   4. Create/cancel collapse uses the form h3 negative assertion, NOT the
 *      input — page may host other 名称 inputs later.
 *   5. 文章数 column-header scenario is categories-only (per source spec);
 *      not extended into tags even though tags now render the same header.
 *   6. Path-level pathname guard for every page-load (expectPathname), no
 *      loose toHaveURL regex.
 */
import { test, expect, expectPathname } from "./fixtures";

// ---------------------------------------------------------------------------
// Feature: Admin categories page
// ---------------------------------------------------------------------------

test.describe("Feature: Admin categories page", () => {
  test("Given /admin/categories is requested, When I open it, Then the AdminShell h1 (分类) is visible", async ({
    page,
  }) => {
    // Given/When: open the categories page.
    await page.goto("/admin/categories", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/categories");

    // Then: AdminShell h1 — i18n key "admin.page.categories" → "分类"
    // (src/lib/i18n/index.ts).
    await expect(
      page.getByRole("heading", { level: 1, name: "分类" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/categories renders, When I view the list, Then the table is visible and per-state surfaces 暂无分类 (empty) OR the first 编辑 row action (non-empty)", async ({
    page,
  }) => {
    // Given/When: open the categories page.
    await page.goto("/admin/categories", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/categories");

    // Then: taxonomy-manager-table.tsx:142-194: <table> is always rendered;
    // empty branch fills a single <td colSpan=...> with "暂无分类", non-empty
    // branch fills <tbody> with rows that include 编辑 buttons.
    const table = page.getByRole("table");
    await expect(table).toBeVisible({ timeout: 10_000 });

    // Then: state branch — empty branch asserts the exact 暂无分类 text scoped
    // to <table>; non-empty branch asserts the first row 编辑 action. Both
    // sides must positively assert a visible element so an unexpected layout
    // fails the scenario.
    const editButtons = table.getByRole("button", { name: "编辑" });
    const editCount = await editButtons.count();
    if (editCount === 0) {
      await expect(
        table.getByText("暂无分类", { exact: true }),
      ).toBeVisible();
    } else {
      await expect(editButtons.first()).toBeVisible();
    }
  });

  test("Given /admin/categories renders, When I click 新建分类, Then the inline form h3 and 名称/别名 inputs are visible; clicking 取消 collapses the form", async ({
    page,
  }) => {
    // Given: open the categories page.
    await page.goto("/admin/categories", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/categories");

    // When: click 新建分类 — taxonomy-manager.tsx:177-184 button label is
    // exactly "新建分类".
    await page
      .getByRole("button", { name: "新建分类", exact: true })
      .click();

    // Then: taxonomy-manager-form.tsx:54-56 → h3 "新建分类" (level 3).
    const formHeading = page.getByRole("heading", {
      level: 3,
      name: "新建分类",
    });
    await expect(formHeading).toBeVisible({ timeout: 10_000 });

    // Then: FormField wires htmlFor→id for 名称 (id=taxonomy-name) and
    // 别名 (id=taxonomy-slug) — getByLabel is the stable accessor.
    await expect(page.getByLabel("名称")).toBeVisible();
    await expect(page.getByLabel("别名")).toBeVisible();

    // When: click 取消 inside the form (taxonomy-manager-form.tsx:102-104).
    await page.getByRole("button", { name: "取消", exact: true }).click();

    // Then: negative assertion on the form heading (NOT the input) so this
    // still catches the regression when other 名称 inputs exist on the page.
    await expect(formHeading).not.toBeVisible();
  });

  test("Given /admin/categories renders with at least one category, When I click the first 编辑, Then the inline form h3 (编辑分类) is visible and 名称 has a non-empty value; 取消 collapses the form", async ({
    page,
  }) => {
    // Given: open the categories page.
    await page.goto("/admin/categories", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/categories");

    // Given: scope 编辑 buttons to the table — the only edit-buttons on this
    // page are the row actions. emptyDataGate would be appropriate but the
    // page has no other "edit" surface, so a direct test.skip is enough.
    const table = page.getByRole("table");
    const editButtons = table.getByRole("button", { name: "编辑" });
    const editCount = await editButtons.count();
    // Then: empty branch skips with explicit reason; non-empty branch
    // proceeds to assert the edit form.
    test.skip(
      editCount === 0,
      "No categories available to edit in current seed.",
    );

    // When: click the first row 编辑 button.
    await editButtons.first().click();

    // Then: taxonomy-manager-form.tsx:54-56 → h3 "编辑分类" in edit mode.
    const formHeading = page.getByRole("heading", {
      level: 3,
      name: "编辑分类",
    });
    await expect(formHeading).toBeVisible({ timeout: 10_000 });

    // Then: existing row's name must be pre-filled.
    const nameInput = page.getByLabel("名称");
    await expect(nameInput).toBeVisible();
    const nameValue = await nameInput.inputValue();
    expect(
      nameValue.length,
      "edit form populated 名称 input with empty value",
    ).toBeGreaterThan(0);

    // When: click 取消. Then: form heading collapses.
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await expect(formHeading).not.toBeVisible();
  });

  test("Given /admin/categories renders, When I view the table, Then the 文章数 column header is visible", async ({
    page,
  }) => {
    // Given/When: open the categories page.
    await page.goto("/admin/categories", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/categories");

    // Then: taxonomy-manager-table.tsx:151 — <th>文章数</th>. columnheader
    // role disambiguates from row-body cells that may render counts as text.
    await expect(
      page.getByRole("columnheader", { name: "文章数" }),
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Feature: Admin tags page
// ---------------------------------------------------------------------------

test.describe("Feature: Admin tags page", () => {
  test("Given /admin/tags is requested, When I open it, Then the AdminShell h1 (标签) is visible", async ({
    page,
  }) => {
    // Given/When: open the tags page.
    await page.goto("/admin/tags", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/tags");

    // Then: AdminShell h1 — i18n key "admin.page.tags" → "标签".
    await expect(
      page.getByRole("heading", { level: 1, name: "标签" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/tags renders, When I view the list, Then the table is visible and per-state surfaces 暂无标签 (empty) OR the first 编辑 row action (non-empty)", async ({
    page,
  }) => {
    // Given/When: open the tags page.
    await page.goto("/admin/tags", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/tags");

    // Then: the table is always rendered.
    const table = page.getByRole("table");
    await expect(table).toBeVisible({ timeout: 10_000 });

    // Then: state branch — empty branch asserts exact 暂无标签 inside the
    // table; non-empty branch asserts the first row 编辑 action.
    const editButtons = table.getByRole("button", { name: "编辑" });
    const editCount = await editButtons.count();
    if (editCount === 0) {
      await expect(
        table.getByText("暂无标签", { exact: true }),
      ).toBeVisible();
    } else {
      await expect(editButtons.first()).toBeVisible();
    }
  });

  test("Given /admin/tags renders, When I click 新建标签, Then the inline form h3 and 名称/别名/描述（可选） inputs are visible; clicking 取消 collapses the form", async ({
    page,
  }) => {
    // Given: open the tags page.
    await page.goto("/admin/tags", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/tags");

    // When: click 新建标签.
    await page
      .getByRole("button", { name: "新建标签", exact: true })
      .click();

    // Then: form heading appears in create mode.
    const formHeading = page.getByRole("heading", {
      level: 3,
      name: "新建标签",
    });
    await expect(formHeading).toBeVisible({ timeout: 10_000 });

    // Then: tags form exposes one additional input — description (optional).
    // FormField id=taxonomy-description, label "描述（可选）".
    await expect(page.getByLabel("名称")).toBeVisible();
    await expect(page.getByLabel("别名")).toBeVisible();
    await expect(page.getByLabel("描述（可选）")).toBeVisible();

    // When: click 取消. Then: form heading collapses.
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await expect(formHeading).not.toBeVisible();
  });

  test("Given /admin/tags renders with at least one tag, When I click the first 编辑, Then the inline form h3 (编辑标签) is visible and 名称 has a non-empty value; 取消 collapses the form", async ({
    page,
  }) => {
    // Given: open the tags page.
    await page.goto("/admin/tags", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/tags");

    // Given: scope 编辑 buttons to the table.
    const table = page.getByRole("table");
    const editButtons = table.getByRole("button", { name: "编辑" });
    const editCount = await editButtons.count();
    // Then: empty branch skips with explicit reason; non-empty branch
    // proceeds to assert the edit form.
    test.skip(
      editCount === 0,
      "No tags available to edit in current seed.",
    );

    // When: click the first row 编辑 button.
    await editButtons.first().click();

    // Then: form heading appears in edit mode.
    const formHeading = page.getByRole("heading", {
      level: 3,
      name: "编辑标签",
    });
    await expect(formHeading).toBeVisible({ timeout: 10_000 });

    // Then: existing row's name must be pre-filled.
    const nameInput = page.getByLabel("名称");
    await expect(nameInput).toBeVisible();
    const nameValue = await nameInput.inputValue();
    expect(
      nameValue.length,
      "edit form populated 名称 input with empty value",
    ).toBeGreaterThan(0);

    // When: click 取消. Then: form heading collapses.
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await expect(formHeading).not.toBeVisible();
  });
});
