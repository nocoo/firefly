/**
 * L3 BDD: Admin backup (Backy) + MCP tokens pages.
 *
 * Phase 2.4 of L3 → BDD migration (see docs/25-l3-bdd-refactor.md §3, §4.2).
 *
 * Source spec attribution (14 → 14 scenarios, no merges; configured /
 * unconfigured branches made explicit per reviewer pins below):
 *   - browser/admin-backup-mcp.spec.ts (entire file, 14 tests across 2 describes)
 *
 * Mapping (old test → new scenario):
 *
 * --- Admin backup page (7 → 7) ---
 *   "Admin backup page > backup page loads"
 *       → "Given /admin/backup is requested, ... the AdminShell h1 (备份) is visible"
 *   "Admin backup page > shows Backy configuration section"
 *       → "Given /admin/backup renders, ... the 远程备份 card (BackupPushCard h2 + Backy copy) is visible"
 *   "Admin backup page > shows webhook URL input"
 *       → "Given the push card is in editMode (no Backy config), ... the Webhook URL label and matching <Input> are visible; if already configured, skip with explicit reason"
 *   "Admin backup page > shows API key input"
 *       → "Given the push card is in editMode (no Backy config), ... the API Key label and <Input type=password> are visible; if already configured, skip with explicit reason"
 *   "Admin backup page > has save/connect button"
 *       → "Given the push card renders, ... editMode exposes 保存; configured mode exposes 测试连接 + 推送备份 (state branch, no silent skip)"
 *   "Admin backup page > shows pull key section"
 *       → "Given the pull card renders, ... the 拉取 Webhook h2 is always visible; no-pullKey branch exposes 生成凭证, with-pullKey branch exposes Webhook URL + X-Webhook-Key + 重新生成"
 *   "Admin backup page > shows backup history if configured"
 *       → "Given the push card is configured, ... the 备份记录 h3 + 刷新 button + (history rows OR empty fallback) are visible; if not configured, skip with explicit reason"
 *
 * --- Admin MCP tokens page (7 → 7) ---
 *   "Admin MCP tokens page > MCP page loads"
 *       → "Given /admin/mcp is requested, ... the AdminShell h1 (MCP 令牌) is visible"
 *   "Admin MCP tokens page > shows MCP URL"
 *       → "Given /admin/mcp renders, ... the 配置指南 h3 and the MCP 端点 code containing /api/mcp are visible"
 *   "Admin MCP tokens page > shows setup guide with tabs"
 *       → "Given the setup guide renders, ... all three tabs (Claude Code / Cursor / cURL) are visible; clicking cURL surfaces a curl -X POST snippet; clicking Claude Code surfaces a mcpServers + YOUR_TOKEN JSON snippet"
 *   "Admin MCP tokens page > shows token list or empty state"
 *       → "Given /admin/mcp renders, ... if tokens are empty surface the exact EmptyState copy; if tokens exist surface the table headers (客户端 / 令牌 / 权限 / 状态)"
 *   "Admin MCP tokens page > has create token button"
 *       → "Given /admin/mcp renders, ... the create-form 客户端名称 label, name <Input>, and 创建令牌 button are visible"
 *   "Admin MCP tokens page > shows scope options when creating token"
 *       → "Given /admin/mcp renders, ... the create-form 权限 label and a <select> exposing 完整 + 作者 options are visible (scoped to #mcp-scope)"
 *   "Admin MCP tokens page > shows code snippets for configuration"
 *       → "Given the Claude Code tab is active by default, ... a <pre><code> snippet containing mcpServers and YOUR_TOKEN is visible"
 *
 * Reviewer pins (msg=ccb621ad) honored:
 *   1. Backup push card branches explicitly on editMode (Webhook/API Key/保存)
 *      vs configured (测试连接 + 推送备份). The unconfigured-only inputs use
 *      emptyDataGate when configured-mode is in effect.
 *   2. 拉取 Webhook h2 is always positively asserted; pull key inner controls
 *      branch by state (生成凭证 vs Webhook URL + X-Webhook-Key + 重新生成).
 *   3. Token list/empty-state checks the EmptyState copy or the table header
 *      row, NOT the create-form 客户端名称 label.
 *   4. Scope scenario asserts the create-form select scoped to #mcp-scope (the
 *      table also has a 权限 column, which is what the original test conflated).
 *   5. Setup guide scenario actively switches tabs and verifies the snippet
 *      body, not just `pre code` visibility.
 *   6. Commit body mapping keeps 14 entries with state branches noted in-line.
 */
import { test, expect } from "./fixtures";

// ---------------------------------------------------------------------------
// Local helper — path-level URL guard (same pattern as auth.spec.ts /
// admin-dashboard.spec.ts / admin-settings.spec.ts).
// ---------------------------------------------------------------------------

async function expectPathname(
  page: import("@playwright/test").Page,
  expected: string,
): Promise<void> {
  const { pathname } = new URL(page.url());
  expect(pathname).toBe(expected);
}

// ---------------------------------------------------------------------------
// Feature: Admin backup page
// ---------------------------------------------------------------------------

test.describe("Feature: Admin backup page", () => {
  test("Given /admin/backup is requested, When I open it, Then the AdminShell h1 (备份) is visible", async ({
    page,
  }) => {
    await page.goto("/admin/backup", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/backup");

    // AdminShell h1 — i18n key "admin.page.backup" → "备份"
    // (src/components/admin/shell.tsx:34 + src/lib/i18n/index.ts:44).
    await expect(
      page.getByRole("heading", { level: 1, name: "备份" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/backup renders, When I view it, Then the 远程备份 card is visible", async ({
    page,
  }) => {
    await page.goto("/admin/backup", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/backup");

    // BackupPushCard h2 (backup-push-card.tsx:238). 远程备份 is the stable
    // heading the original "Backy configuration section" test was probing —
    // the Backy literal itself does not appear in the rendered DOM.
    await expect(
      page.getByRole("heading", { level: 2, name: "远程备份" }),
    ).toBeVisible({ timeout: 10_000 });
    // Card body copy below the heading also asserts the Backy intent.
    await expect(
      page.getByText("将博客数据推送至 Backy 远程备份服务。"),
    ).toBeVisible();
  });

  test("Given the push card is in editMode, When I view it, Then the Webhook URL label and input are visible (skip when configured)", async ({
    page,
  }) => {
    await page.goto("/admin/backup", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/backup");

    // editMode is the unconfigured branch (backup-push-card.tsx:100,244-279).
    // The Webhook URL input only renders here. Detect editMode via the
    // unique "Bearer token" placeholder on the API Key input (only present
    // when configured is false — configured uses "留空则保持不变").
    const editModeProbe = page.locator('input[placeholder="Bearer token"]');
    const isEditMode = (await editModeProbe.count()) > 0;
    test.skip(
      !isEditMode,
      "Backup push card is in configured read-mode; Webhook URL input only renders in editMode.",
    );

    await expect(page.getByText("Webhook URL").first()).toBeVisible({
      timeout: 10_000,
    });
    // CSS attribute selector: <Input> exposes no role/testid; placeholder is
    // the stable structural identifier for the editMode webhook input.
    await expect(
      page.locator('input[placeholder^="https://example.com/api/webhook"]'),
    ).toBeVisible();
  });

  test("Given the push card is in editMode, When I view it, Then the API Key label and password input are visible (skip when configured)", async ({
    page,
  }) => {
    await page.goto("/admin/backup", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/backup");

    const editModeProbe = page.locator('input[placeholder="Bearer token"]');
    const isEditMode = (await editModeProbe.count()) > 0;
    test.skip(
      !isEditMode,
      "Backup push card is in configured read-mode; API Key input only renders in editMode.",
    );

    await expect(page.getByText("API Key").first()).toBeVisible({
      timeout: 10_000,
    });
    // Only one <input type="password"> on the page (the API Key input).
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("Given the push card renders, When I view it, Then editMode exposes 保存 OR configured mode exposes 测试连接 + 推送备份", async ({
    page,
  }) => {
    await page.goto("/admin/backup", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/backup");

    // State branch — both legitimate landings should pass without silent
    // fallback. editMode probe via the same "Bearer token" placeholder.
    const editModeProbe = page.locator('input[placeholder="Bearer token"]');
    const isEditMode = (await editModeProbe.count()) > 0;
    if (isEditMode) {
      // editMode save button — exact match so it does not also match
      // "推送备份" (which uses 备份, not 保存).
      await expect(
        page.getByRole("button", { name: "保存", exact: true }),
      ).toBeVisible({ timeout: 10_000 });
    } else {
      // configured read-mode: both action buttons visible
      // (backup-push-card.tsx:303-312).
      await expect(
        page.getByRole("button", { name: /测试连接/ }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByRole("button", { name: /推送备份/ }),
      ).toBeVisible();
    }
  });

  test("Given the pull card renders, When I view it, Then the 拉取 Webhook h2 is always visible and inner controls branch by pullKey state", async ({
    page,
  }) => {
    await page.goto("/admin/backup", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/backup");

    // 拉取 Webhook card heading is always rendered (backup-pull-card.tsx:46).
    await expect(
      page.getByRole("heading", { level: 2, name: "拉取 Webhook" }),
    ).toBeVisible({ timeout: 10_000 });

    // Scope to the pull card root so the "Webhook URL" label below does not
    // collide with the push card's editMode label (backup-push-card.tsx:248).
    // Both push and pull cards use `.rounded-card` (backup-push-card.tsx:235,
    // backup-pull-card.tsx:43); filtering by the unique 拉取 Webhook h2 picks
    // exactly the pull card root.
    const pullCard = page.locator(".rounded-card").filter({
      has: page.getByRole("heading", { level: 2, name: "拉取 Webhook" }),
    });

    // State branch: pullKey present → readout view; absent → 生成凭证 button.
    const generateButton = pullCard.getByRole("button", { name: /生成凭证/ });
    const regenerateButton = pullCard.getByRole("button", {
      name: /重新生成/,
    });
    const hasGenerate = (await generateButton.count()) > 0;
    const hasRegenerate = (await regenerateButton.count()) > 0;
    expect(
      hasGenerate || hasRegenerate,
      "pull card rendered neither the 生成凭证 nor the 重新生成 button — broken state branch",
    ).toBe(true);

    if (hasGenerate) {
      await expect(generateButton.first()).toBeVisible();
    } else {
      // pullKey is set — assert the full readout: Webhook URL label, the
      // /api/backup/pull endpoint code, the X-Webhook-Key label, and the curl
      // example. All scoped to pullCard so the push card editMode label and
      // any other "Webhook URL" string elsewhere on the page do not satisfy.
      await expect(pullCard.getByText("Webhook URL").first()).toBeVisible();
      await expect(
        pullCard.getByText(/\/api\/backup\/pull/).first(),
      ).toBeVisible();
      await expect(pullCard.getByText("X-Webhook-Key")).toBeVisible();
      await expect(pullCard.getByText(/curl -X POST/)).toBeVisible();
      await expect(regenerateButton.first()).toBeVisible();
      await expect(
        pullCard.getByRole("button", { name: /撤销/ }),
      ).toBeVisible();
    }
  });

  test("Given the push card is configured, When I view it, Then the 备份记录 h3 + 刷新 button + (history rows OR empty fallback) are visible (skip when in editMode)", async ({
    page,
  }) => {
    await page.goto("/admin/backup", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/backup");

    // 备份记录 only renders inside configured mode (backup-push-card.tsx:64-91
    // is mounted by the configured branch at L318).
    const editModeProbe = page.locator('input[placeholder="Bearer token"]');
    const isEditMode = (await editModeProbe.count()) > 0;
    test.skip(
      isEditMode,
      "Backup push card is in editMode (Backy not configured); 备份记录 section only renders in configured mode.",
    );

    // h3 heading + the inline refresh button (a <Button variant=ghost> with
    // RefreshCw icon and "刷新" label).
    await expect(
      page.getByRole("heading", { level: 3, name: "备份记录" }),
    ).toBeVisible({ timeout: 10_000 });

    // Scope to the HistorySection root (backup-push-card.tsx:64-91): the
    // `<div className="border-t border-border pt-4 space-y-3">` wrapper that
    // contains the 备份记录 h3. Filtering by that distinctive class signature
    // pins us to HistorySection itself so the rows locator below cannot catch
    // unrelated `.divide-y > div` matches elsewhere on the page (e.g. inside
    // PushDetailBox or future siblings).
    const historySection = page
      .locator("div.border-t.border-border")
      .filter({
        has: page.getByRole("heading", { level: 3, name: "备份记录" }),
      });

    await expect(
      historySection.getByRole("button", { name: /刷新/ }),
    ).toBeVisible();

    // Three legitimate render branches (backup-push-card.tsx:74-88):
    //   - history === null              → "推送备份后将显示远程备份记录。"
    //   - history with no entries       → "暂无备份记录"
    //   - history with entries          → .divide-y rows
    // Assert visibility on whichever branch is active — count-only would let
    // a future regression that returns 0 width/0 height blocks slip through.
    const initialHint = historySection.getByText(
      "推送备份后将显示远程备份记录。",
    );
    const emptyHint = historySection.getByText("暂无备份记录");
    const rows = historySection.locator(".divide-y > div").first();
    const initialCount = await initialHint.count();
    const emptyCount = await emptyHint.count();
    const rowCount = await rows.count();
    expect(
      initialCount + emptyCount + rowCount,
      "history section rendered neither the initial hint, the empty state, nor any history row",
    ).toBeGreaterThan(0);

    if (initialCount > 0) {
      await expect(initialHint).toBeVisible();
    } else if (emptyCount > 0) {
      await expect(emptyHint).toBeVisible();
    } else {
      await expect(rows).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Feature: Admin MCP tokens page
// ---------------------------------------------------------------------------

test.describe("Feature: Admin MCP tokens page", () => {
  test("Given /admin/mcp is requested, When I open it, Then the AdminShell h1 (MCP 令牌) is visible", async ({
    page,
  }) => {
    await page.goto("/admin/mcp", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/mcp");

    // AdminShell h1 — i18n key "admin.page.mcp" → "MCP 令牌"
    // (src/components/admin/shell.tsx:33 + src/lib/i18n/index.ts:43).
    await expect(
      page.getByRole("heading", { level: 1, name: "MCP 令牌" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/mcp renders, When I view it, Then the 配置指南 h3 and the MCP 端点 code containing /api/mcp are visible", async ({
    page,
  }) => {
    await page.goto("/admin/mcp", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/mcp");

    // McpSetupGuide h3 (mcp-tokens-setup-guide.tsx:114).
    await expect(
      page.getByRole("heading", { level: 3, name: "配置指南" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("MCP 端点")).toBeVisible();
    // The MCP endpoint URL is rendered into a <code> element next to the
    // 端点 label and also embedded in the active code snippet. Either
    // occurrence satisfies the "shows MCP URL" assertion.
    await expect(page.getByText(/\/api\/mcp/).first()).toBeVisible();
  });

  test("Given the setup guide renders, When I switch tabs, Then cURL surfaces a curl -X POST snippet and Claude Code surfaces a mcpServers + YOUR_TOKEN JSON snippet", async ({
    page,
  }) => {
    await page.goto("/admin/mcp", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/mcp");

    // All three tab triggers visible (mcp-tokens-setup-guide.tsx:101-105).
    const claudeTab = page.getByRole("button", { name: "Claude Code" });
    const cursorTab = page.getByRole("button", { name: "Cursor" });
    const cliTab = page.getByRole("button", { name: "cURL" });
    await expect(claudeTab).toBeVisible({ timeout: 10_000 });
    await expect(cursorTab).toBeVisible();
    await expect(cliTab).toBeVisible();

    // Default tab is "claude" (mcp-tokens-setup-guide.tsx:90): JSON snippet.
    // The <pre><code> body contains the actual snippet text.
    const codeBlock = page.locator("pre code");
    await expect(codeBlock).toContainText("mcpServers");
    await expect(codeBlock).toContainText("YOUR_TOKEN");

    // Click cURL → bash snippet with `curl -X POST`.
    await cliTab.click();
    await expect(codeBlock).toContainText("curl -X POST");

    // Click back to Claude Code → JSON snippet again.
    await claudeTab.click();
    await expect(codeBlock).toContainText("mcpServers");
  });

  test("Given /admin/mcp renders, When I view the token list area, Then it shows the EmptyState copy or the table headers (客户端 / 令牌 / 权限 / 状态)", async ({
    page,
  }) => {
    await page.goto("/admin/mcp", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/mcp");

    // EmptyState message (mcp-tokens-manager.tsx:170) — exact copy.
    const emptyState = page.getByText(
      "暂无 MCP 令牌。创建一个以连接 AI Agent。",
    );
    // Table header row — McpTokensTable renders <th> 客户端 / 令牌 / 权限 / 状态
    // (mcp-tokens-table.tsx:123-128).
    const clientHeader = page.getByRole("columnheader", { name: "客户端" });
    const tokenHeader = page.getByRole("columnheader", { name: "令牌" });
    const scopeHeader = page.getByRole("columnheader", { name: "权限" });
    const statusHeader = page.getByRole("columnheader", { name: "状态" });

    const emptyCount = await emptyState.count();
    const headerCount = await clientHeader.count();
    expect(
      emptyCount + headerCount,
      "token list area rendered neither the EmptyState copy nor the table header row",
    ).toBeGreaterThan(0);

    if (emptyCount > 0) {
      await expect(emptyState).toBeVisible();
    } else {
      await expect(clientHeader).toBeVisible();
      await expect(tokenHeader).toBeAttached(); // hidden on mobile via sm:table-cell
      await expect(scopeHeader).toBeVisible();
      await expect(statusHeader).toBeVisible();
    }
  });

  test("Given /admin/mcp renders, When I view the create form, Then the 客户端名称 label, name input, and 创建令牌 button are visible", async ({
    page,
  }) => {
    await page.goto("/admin/mcp", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/mcp");

    // FormField wraps the label with htmlFor="mcp-client-name" linking to
    // the inner <Input id="mcp-client-name"> — so getByLabel is valid here.
    const nameInput = page.getByLabel("客户端名称");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("button", { name: /创建令牌/ }),
    ).toBeVisible();
  });

  test("Given /admin/mcp renders, When I view the create form, Then the 权限 label and #mcp-scope select expose 完整 + 作者", async ({
    page,
  }) => {
    await page.goto("/admin/mcp", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/mcp");

    // Scope label/select is in the create form via FormField id="mcp-scope".
    // Scoping to the select by id avoids matching the 权限 <th> in the
    // tokens table (when tokens exist).
    const scopeSelect = page.locator("select#mcp-scope");
    await expect(scopeSelect).toBeVisible({ timeout: 10_000 });
    await expect(scopeSelect).toHaveValue("full");
    // Both <option> values exist (mcp-tokens-create-form.tsx:51-52).
    await expect(
      scopeSelect.locator('option[value="full"]'),
    ).toHaveText("完整");
    await expect(
      scopeSelect.locator('option[value="author"]'),
    ).toHaveText("作者");
  });

  test("Given the Claude Code tab is active by default, When I view the snippet, Then a pre/code block containing mcpServers and YOUR_TOKEN is visible", async ({
    page,
  }) => {
    await page.goto("/admin/mcp", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/mcp");

    // mcp-tokens-setup-guide.tsx:90 — default activeTab is "claude" (the
    // JSON mcpServers config). The <CodeBlock> uses <pre><code>.
    const codeBlock = page.locator("pre code");
    await expect(codeBlock).toBeVisible({ timeout: 10_000 });
    await expect(codeBlock).toContainText("mcpServers");
    await expect(codeBlock).toContainText("YOUR_TOKEN");
  });
});
