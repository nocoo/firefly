/**
 * L3 BDD: Admin AI agents list + new agent form.
 *
 * Phase 3.3 of L3 → BDD migration (see docs/25-l3-bdd-refactor.md §3, §4.2).
 *
 * Source spec attribution (14 → 14 scenarios, no merges):
 *   - browser/admin-ai-agents.spec.ts (14 tests across 2 describes)
 *
 * TWO old tests were vacuous (their selectors never matched real DOM):
 *   - List "shows agent cards with avatar and info" looked for `.agent-card`
 *     / `[data-testid="agent-card"]` / `[role="listitem"]`, none of which
 *     exist — the list renders a `<table>` (AiAgentsTable). The old `if
 *     (count > 0)` branch was never entered, so the test was a silent
 *     pass. Migrated as a real table contract with test.skip on empty seed.
 *   - New-form "shows avatar upload area" looked for `input[type="file"]`
 *     and accepted `count >= 0` (always true). AgentAvatarUploader is only
 *     rendered in edit mode (ai-agent-form.tsx:227 `!isNew && agent`), so
 *     a new-mode page does not render the uploader. Migrated as a positive
 *     contract — assert the uploader's semantic anchors (头像 label, file
 *     input, 上传头像 button) are NOT present in new mode.
 *
 * Mapping (old test → new scenario):
 *
 * --- Admin AI agents list page (5 → 5) ---
 *   "Admin AI agents list page > ai agents page loads"
 *       → "Given /admin/ai-agents is requested, ... AdminShell h1 (AI 代理) is visible"
 *   "Admin AI agents list page > shows agent list or empty state"
 *       → "Given /admin/ai-agents renders, ... manager h1 (AI 代理作者) is
 *          visible; empty branch surfaces 还没有 AI 代理 copy, non-empty
 *          branch surfaces <table> + 名称 columnheader"
 *   "Admin AI agents list page > has create agent button"
 *       → "Given /admin/ai-agents renders, ... the header 创建代理 button is
 *          visible (scoped via .first() since empty-state card also renders one)"
 *   "Admin AI agents list page > shows agent cards with avatar and info"
 *     [UPGRADED FROM VACUOUS: old .agent-card selector never matched real <table>]
 *       → "Given /admin/ai-agents renders with >=1 agent, ... <table> + all
 *          four columnheaders (名称/绑定分类/Author ID/文章数) + first row
 *          编辑 action button are visible; test.skip with explicit reason on
 *          empty seed"
 *   "Admin AI agents list page > clicking create navigates to new agent form"
 *       → "Given /admin/ai-agents renders, When I click the header 创建代理
 *          button, Then pathname becomes /admin/ai-agents/new (hard assert,
 *          no conditional skip)"
 *
 * --- Admin AI agent new form (9 → 9) ---
 *   "Admin AI agent form - new agent > new agent page loads"
 *       → "Given /admin/ai-agents/new is requested, ... pathname matches +
 *          form h1 (创建 AI 代理) is visible"
 *   "Admin AI agent form - new agent > shows name input"
 *       → "Given /admin/ai-agents/new renders, ... placeholder=如：科技写手
 *          input is visible"
 *   "Admin AI agent form - new agent > shows slug input"
 *       → "Given /admin/ai-agents/new renders, ... placeholder=如：tech-writer
 *          input is visible"
 *   "Admin AI agent form - new agent > shows category selector"
 *       → "Given /admin/ai-agents/new renders, ... category <select> (with
 *          选择分类... placeholder option) is visible"
 *   "Admin AI agent form - new agent > shows description textarea"
 *       → "Given /admin/ai-agents/new renders, ... placeholder=代理的可选描述
 *          textarea is visible"
 *   "Admin AI agent form - new agent > shows avatar upload area"
 *     [UPGRADED FROM VACUOUS: old `count >= 0` always passed]
 *       → "Given /admin/ai-agents/new renders in new mode, ... the
 *          AgentAvatarUploader is NOT rendered: 头像 label hidden, no
 *          input[type=file], 上传头像 button hidden (uploader gates on
 *          !isNew && agent)"
 *   "Admin AI agent form - new agent > has save button"
 *       → "Given /admin/ai-agents/new renders, ... 创建代理 save button is
 *          visible at form footer"
 *   "Admin AI agent form - new agent > has back button"
 *       → "Given /admin/ai-agents/new renders, ... 返回 back button is visible"
 *   "Admin AI agent form - new agent > auto-generates slug from name"
 *       → "Given /admin/ai-agents/new renders, When I fill name with a
 *          unique prefix (E2E Admin AI Agents <ts> Test), Then slug input
 *          auto-fills to slugified value (no timeout, expect.toHaveValue
 *          polls for the React effect)"
 *
 * Reviewer pins (msg=b7e05c36) honored:
 *   1. List "cards" scenario hard-asserts <table> + all 4 columnheaders +
 *      first row action; emptyDataGate via explicit test.skip.
 *   2. List/empty scenario uses exact empty-state copy + positive table
 *      anchor for non-empty branch (no regex OR combinator).
 *   3. Create-button scoped to .first() so empty-card duplicate doesn't
 *      cause strict-mode violation. Navigate scenario hard-asserts pathname.
 *   4. Avatar reverse-assert narrowed to uploader's semantic anchors (头像
 *      label / file input / 上传头像 button), not generic "no img".
 *   5. /admin/ai-agents/new contract noted in scenario comment: id === "new"
 *      → agent=null → uploader gated off → h1 is form's "创建 AI 代理".
 *   6. slug auto-gen uses expect.toHaveValue() poll instead of waitForTimeout.
 *   7. Back button pinned to 返回 (not the source's 返回/取消 fallback).
 */
import { test, expect } from "./fixtures";

// ---------------------------------------------------------------------------
// Local helper — path-level URL guard (shared pattern across the BDD suite).
// ---------------------------------------------------------------------------

async function expectPathname(
  page: import("@playwright/test").Page,
  expected: string,
): Promise<void> {
  const { pathname } = new URL(page.url());
  expect(pathname).toBe(expected);
}

// ---------------------------------------------------------------------------
// Feature: Admin AI agents list page
// ---------------------------------------------------------------------------

test.describe("Feature: Admin AI agents list page", () => {
  test("Given /admin/ai-agents is requested, When I open it, Then the AdminShell h1 (AI 代理) is visible", async ({
    page,
  }) => {
    await page.goto("/admin/ai-agents", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/ai-agents");

    // AdminShell h1 — i18n key "admin.page.ai-agents" → "AI 代理"
    // (src/lib/i18n/index.ts:41, src/components/admin/shell.tsx:32). Page
    // also renders AiAgentsManager h1 "AI 代理作者" — exact: true keeps
    // "AI 代理" from substring-matching "AI 代理作者".
    await expect(
      page.getByRole("heading", { level: 1, name: "AI 代理", exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/ai-agents renders, When I view the list, Then the manager h1 is visible and per-state surfaces the empty-state copy OR the agents table", async ({
    page,
  }) => {
    await page.goto("/admin/ai-agents", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/ai-agents");

    // Positive anchor: AiAgentsManager always renders its own h1.
    await expect(
      page.getByRole("heading", { level: 1, name: "AI 代理作者", exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    // ai-agents-manager.tsx:124 — empty state renders the exact copy;
    // non-empty renders <AiAgentsTable>. Branch positively on visible
    // signature on each side (never regex OR combinator).
    const tableCount = await page.getByRole("table").count();
    if (tableCount === 0) {
      await expect(
        page.getByText(
          "还没有 AI 代理。创建一个以允许 AI 发布内容。",
          { exact: true },
        ),
      ).toBeVisible();
    } else {
      await expect(page.getByRole("table")).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: "名称" }),
      ).toBeVisible();
    }
  });

  test("Given /admin/ai-agents renders, When I view the page, Then the 创建代理 button is visible", async ({
    page,
  }) => {
    await page.goto("/admin/ai-agents", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/ai-agents");

    // ai-agents-manager.tsx:118 (header) + L130 (empty-state card) both
    // render "创建代理" — .first() picks the header instance regardless
    // of state. Source spec lived with this duplicate; here we declare it.
    await expect(
      page.getByRole("button", { name: "创建代理" }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/ai-agents renders with at least one agent, When I view the table, Then all four columnheaders and the first row 编辑 action are visible", async ({
    page,
  }) => {
    await page.goto("/admin/ai-agents", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/ai-agents");

    // The original test looked for `.agent-card` / `[data-testid="agent-card"]`
    // / `[role="listitem"]`, none of which exist in ai-agents-table.tsx (the
    // real component renders a <table>). With a count > 0 guard, the assertion
    // was never run. This scenario rewrites it against the actual DOM.
    const table = page.getByRole("table");
    const tableCount = await table.count();
    test.skip(
      tableCount === 0,
      "No AI agents available to populate the table in current seed.",
    );

    // ai-agents-table.tsx:108-120 — four <th>s in this exact order.
    await expect(table).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "名称" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "绑定分类" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Author ID" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "文章数" }),
    ).toBeVisible();

    // ai-agents-table.tsx:62-69 — each row has an 编辑 icon-button
    // (title attr provides accessible name).
    await expect(
      table.getByRole("button", { name: "编辑" }).first(),
    ).toBeVisible();
  });

  test("Given /admin/ai-agents renders, When I click the 创建代理 button, Then I am navigated to /admin/ai-agents/new", async ({
    page,
  }) => {
    await page.goto("/admin/ai-agents", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/ai-agents");

    // Hard click — no conditional skip (the button is always rendered, in
    // either header or empty-state card). ai-agents-manager.tsx:70 routes
    // to /admin/ai-agents/new via router.push.
    await page.getByRole("button", { name: "创建代理" }).first().click();
    await page.waitForURL("**/admin/ai-agents/new", { timeout: 10_000 });
    await expectPathname(page, "/admin/ai-agents/new");
  });
});

// ---------------------------------------------------------------------------
// Feature: Admin AI agent new form
//
// Route contract (src/app/admin/ai-agents/[id]/page.tsx):
//   - /admin/ai-agents/new → params.id === "new" → agent = null → isNew=true
//   - AgentAvatarUploader is gated on !isNew && agent (ai-agent-form.tsx:227)
//     → uploader is NOT rendered in new mode
//   - h1 in form is "创建 AI 代理" (ai-agent-form.tsx:147)
// ---------------------------------------------------------------------------

test.describe("Feature: Admin AI agent new form", () => {
  test("Given /admin/ai-agents/new is requested, When I open it, Then pathname matches and the form h1 (创建 AI 代理) is visible", async ({
    page,
  }) => {
    await page.goto("/admin/ai-agents/new", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/ai-agents/new");

    // Form h1 — exact: true distinguishes it from AdminShell h1 "AI 代理"
    // (PAGE_TITLE_KEYS prefix-matches /admin/ai-agents). "创建 AI 代理"
    // would otherwise substring-match the AdminShell "AI 代理" as well.
    await expect(
      page.getByRole("heading", { level: 1, name: "创建 AI 代理", exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/ai-agents/new renders, When I view the form, Then the 名称 input (placeholder 如：科技写手) is visible", async ({
    page,
  }) => {
    await page.goto("/admin/ai-agents/new", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/ai-agents/new");

    // ai-agent-form.tsx:160 — placeholder is exactly "如：科技写手".
    await expect(
      page.getByPlaceholder("如：科技写手"),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/ai-agents/new renders, When I view the form, Then the 标识符 input (placeholder 如：tech-writer) is visible", async ({
    page,
  }) => {
    await page.goto("/admin/ai-agents/new", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/ai-agents/new");

    // ai-agent-form.tsx:170 — placeholder is exactly "如：tech-writer".
    await expect(
      page.getByPlaceholder("如：tech-writer"),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/ai-agents/new renders, When I view the form, Then the 分类 <select> with 选择分类... option is visible", async ({
    page,
  }) => {
    await page.goto("/admin/ai-agents/new", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/ai-agents/new");

    // ai-agent-form.tsx:186 — placeholder option text "选择分类...". The
    // new-mode form renders exactly one <select> (the category one); use
    // hasText filter to keep the assertion semantic.
    const categorySelect = page
      .locator("select")
      .filter({ hasText: "选择分类..." });
    await expect(categorySelect).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/ai-agents/new renders, When I view the form, Then the 描述 textarea (placeholder 代理的可选描述) is visible", async ({
    page,
  }) => {
    await page.goto("/admin/ai-agents/new", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/ai-agents/new");

    // ai-agent-form.tsx:203 — placeholder text "代理的可选描述".
    await expect(
      page.getByPlaceholder("代理的可选描述"),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/ai-agents/new renders in new mode, When I view the form, Then the AgentAvatarUploader is NOT rendered (uploader gates on !isNew && agent)", async ({
    page,
  }) => {
    await page.goto("/admin/ai-agents/new", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/ai-agents/new");

    // ai-agent-form.tsx:227 — uploader is wrapped in `!isNew && agent`. In
    // new mode, none of its semantic anchors should be present:
    //   - "头像" label (ai-agent-avatar-uploader.tsx:87)
    //   - input[type=file] (ai-agent-avatar-uploader.tsx:121)
    //   - "上传头像" button (ai-agent-avatar-uploader.tsx:133)
    // Narrow reverse-assert (NOT "no img on page"): only these three anchors.
    await expect(
      page.getByText("头像", { exact: true }),
    ).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "上传头像" }),
    ).toHaveCount(0);
  });

  test("Given /admin/ai-agents/new renders, When I view the form footer, Then the 创建代理 save button is visible", async ({
    page,
  }) => {
    await page.goto("/admin/ai-agents/new", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/ai-agents/new");

    // ai-agent-form.tsx:240 — footer button label is "创建代理" in new mode.
    // It is the only "创建代理" button on this page (no header dup), so
    // .first() is not strictly required, but the role+name lookup is exact.
    await expect(
      page.getByRole("button", { name: "创建代理" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/ai-agents/new renders, When I view the form header, Then the 返回 back button is visible", async ({
    page,
  }) => {
    await page.goto("/admin/ai-agents/new", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/ai-agents/new");

    // ai-agent-form.tsx:143-145 — exact label "返回". Source spec also
    // accepted "取消" as fallback; we pin "返回" per reviewer pin.
    await expect(
      page.getByRole("button", { name: "返回" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/ai-agents/new renders, When I fill the name with a unique prefix, Then the slug input auto-fills to the slugified value", async ({
    page,
  }) => {
    await page.goto("/admin/ai-agents/new", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/ai-agents/new");

    // Unique prefix prevents cross-test / cross-worker collision even if a
    // future test ever submits this form (current test only reads back the
    // computed slug — never POSTs — so no DB write is performed).
    const ts = Date.now();
    const name = `E2E Admin AI Agents ${ts} Test`;
    const expectedSlug = `e2e-admin-ai-agents-${ts}-test`;

    const nameInput = page.getByPlaceholder("如：科技写手");
    const slugInput = page.getByPlaceholder("如：tech-writer");

    await nameInput.fill(name);
    // toHaveValue polls until the React effect (ai-agent-form.tsx:72-76)
    // syncs slug — no fixed waitForTimeout needed.
    await expect(slugInput).toHaveValue(expectedSlug, { timeout: 5_000 });
  });
});
