/**
 * L3 BDD: Admin settings domain (general / AI / site identity / system monitor).
 *
 * Phase 2.3 of L3 → BDD migration (see docs/25-l3-bdd-refactor.md §3, §4.2).
 *
 * Source spec attribution (21 old tests → 19 scenarios, explicit merges below):
 *   - browser/admin-settings.spec.ts (entire file, 21 tests across 4 describes)
 *
 * Mapping (old test → new scenario):
 *
 * --- Admin general settings page (5 → 5) ---
 *   "Admin general settings page > settings page loads"
 *       → "Given /admin/settings is requested, ... pathname is /admin/settings and the AdminShell h1 (设置) is visible"
 *   "Admin general settings page > shows posts per page input"
 *       → "Given /admin/settings renders, ... the 每页文章数 label and the number input (min=1 max=100) are visible"
 *   "Admin general settings page > shows font style toggle"
 *       → "Given /admin/settings renders, ... the 正文字体风格 control exposes 苹方 / 经典 / 衬线 / 无衬线 segments"
 *   "Admin general settings page > has save button"
 *       → "Given /admin/settings renders, ... the 保存设置 button is visible"
 *   "Admin general settings page > shows internal URLs section"
 *       → "Given /admin/settings renders, ... all four internal URL rows (Sitemap / Robots.txt / RSS Feed / LLMs.txt) are visible"
 *
 * --- Admin AI settings page (5 → 4; one explicit merge) ---
 *   "Admin AI settings page > ai settings page loads"
 *     + "Admin AI settings page > shows provider select"
 *       → MERGED → "Given /admin/ai-settings is requested, ... pathname is /admin/ai-settings, the AdminShell h1 (AI 设置) and the 服务商 & 模型 card with a provider <select> (including the 请选择服务商 placeholder option) are visible"
 *   "Admin AI settings page > shows API key input"
 *       → "Given a provider is actively selected, ... the 认证 card with an API Key password input is visible"
 *   "Admin AI settings page > shows model select when provider is selected"
 *       → "Given a provider is actively selected, ... a 模型 control (select or text input) is visible"
 *   "Admin AI settings page > has save and test buttons"
 *       → "Given a provider is actively selected, ... the 保存设置 and 测试连接 buttons are visible"
 *
 * --- Admin site identity page (6 → 6) ---
 *   "Admin site identity page > site identity page loads"
 *       → "Given /admin/site-identity is requested, ... pathname is /admin/site-identity and the AdminShell h1 (站点身份) is visible"
 *   "Admin site identity page > shows site name input"
 *       → "Given /admin/site-identity renders, ... the 站点信息 card exposes a 站点名称 label paired with a text input"
 *   "Admin site identity page > shows site tagline input"
 *       → "Given /admin/site-identity renders, ... the 站点信息 card exposes a 标语 label paired with a text input"
 *   "Admin site identity page > shows logo upload area"
 *       → "Given /admin/site-identity renders, ... the 站点图标 card exposes an 上传图标 label and a file input"
 *   "Admin site identity page > shows social links section"
 *       → "Given /admin/site-identity renders, ... the 社交链接 card and its + 添加链接 trigger are visible"
 *   "Admin site identity page > has save button"
 *       → "Given /admin/site-identity renders, ... the 保存设置 button is visible at the form footer"
 *
 * --- Admin system monitor page (5 → 4; one explicit merge) ---
 *   "Admin system monitor page > system page loads"
 *       → "Given /admin/system is requested, ... pathname is /admin/system and the AdminShell h1 (系统监控) is visible"
 *   "Admin system monitor page > shows memory stats"
 *     + "Admin system monitor page > shows uptime information"
 *       → MERGED → "Given /admin/system renders the dashboard, ... the four StatCard labels (堆内存使用 / RSS（总内存） / 峰值 / 平均 / 运行时间) are visible"
 *   "Admin system monitor page > has refresh button"
 *       → "Given /admin/system renders the dashboard, ... the 刷新 button is visible"
 *   "Admin system monitor page > shows chart or visualization"
 *       → "Given /admin/system renders the dashboard, ... the 内存使用趋势（48小时） heading is visible AND either a recharts chart container OR the 已采集 N 个样本 empty-state fallback is shown"
 *
 * Reviewer pins (msg=95c8bb96) honored:
 *   1. Static controls (page headings, 保存设置, 每页文章数 input, font/comments toggles,
 *      internal URLs, site name/tagline/logo/social, system 刷新 + StatCards) use positive
 *      assertions, not emptyDataGate.
 *   2. AI 设置 conditional controls (API Key, model, 保存/测试) are exercised by ACTIVELY
 *      selecting the first non-empty provider option; emptyDataGate only fires if the
 *      provider <select> truly has zero non-empty options (a real defect).
 *   3. General-settings labels have no for/id link, so locators key on the literal label
 *      copy and the structural sibling (`input[type="number"]`, SegmentedControl buttons).
 *   4. System chart heading is asserted directly; the data-state branches between the
 *      recharts SVG container and the `已采集 N 个样本` fallback rendered inside the
 *      chart card. No three-layer page-wide fallback.
 *   5. Mapping spells out the two merges (AI 1+2; System memory+uptime) explicitly.
 */
import { test, expect } from "./fixtures";

// ---------------------------------------------------------------------------
// Local helper — path-level URL guard (same pattern as auth.spec.ts /
// admin-dashboard.spec.ts; not yet promoted to fixtures.ts pending policy).
// ---------------------------------------------------------------------------

async function expectPathname(
  page: import("@playwright/test").Page,
  expected: string,
): Promise<void> {
  const { pathname } = new URL(page.url());
  expect(pathname).toBe(expected);
}

// ---------------------------------------------------------------------------
// Feature: Admin general settings page
// ---------------------------------------------------------------------------

test.describe("Feature: Admin general settings page", () => {
  test("Given /admin/settings is requested, When I open it, Then the AdminShell h1 (设置) is visible", async ({
    page,
  }) => {
    await page.goto("/admin/settings", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/settings");

    // AdminShell top-bar <h1> renders i18n key "admin.page.settings" → "设置"
    // (src/components/admin/shell.tsx:30,250-252 + src/lib/i18n/index.ts:40).
    await expect(
      page.getByRole("heading", { level: 1, name: "设置" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/settings renders, When I view it, Then the 每页文章数 label and number input (min=1 max=100) are visible", async ({
    page,
  }) => {
    await page.goto("/admin/settings", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/settings");

    // The <label> has no for/id link to the Input, so we cannot use getByLabel.
    // Assert the label copy + the only `input[type="number"]` on the page
    // (settings-form.tsx:91-106) together — both must be visible.
    await expect(page.getByText("每页文章数")).toBeVisible({ timeout: 10_000 });
    // CSS attribute selector: <Input type="number"> exposes no role/testid;
    // the type+min+max trio is the stable structural identifier here.
    const postsInput = page.locator('input[type="number"][min="1"][max="100"]');
    await expect(postsInput).toBeVisible();
  });

  test("Given /admin/settings renders, When I view it, Then the 正文字体风格 SegmentedControl exposes 苹方 / 经典 / 衬线 / 无衬线", async ({
    page,
  }) => {
    await page.goto("/admin/settings", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/settings");

    await expect(page.getByText("正文字体风格")).toBeVisible({
      timeout: 10_000,
    });
    // SegmentedControl renders each option as a <button> with the localized
    // label as its accessible name (src/components/ui/segmented-control.tsx:35).
    // `exact: true` on 衬线 / 无衬线 — without it 衬线 matches both buttons
    // (strict-mode violation).
    await expect(
      page.getByRole("button", { name: "苹方", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "经典", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "衬线", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "无衬线", exact: true }),
    ).toBeVisible();
  });

  test("Given /admin/settings renders, When I view it, Then the 保存设置 button is visible", async ({
    page,
  }) => {
    await page.goto("/admin/settings", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/settings");

    // settings-form.tsx:228 renders the save trigger as a <Button> with
    // "保存设置" copy (or "保存中..." while saving).
    await expect(
      page.getByRole("button", { name: "保存设置" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/settings renders, When I view it, Then all four internal URL rows (Sitemap / Robots.txt / RSS Feed / LLMs.txt) are visible", async ({
    page,
  }) => {
    await page.goto("/admin/settings", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/settings");

    // 内部功能链接 card (settings-form.tsx:154-209) renders 4 rows, one per
    // entry in `internalUrls` (L13-18). Asserting all 4 labels — not just the
    // section heading — catches regressions where the array is truncated.
    await expect(page.getByText("内部功能链接")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Sitemap", { exact: true })).toBeVisible();
    await expect(page.getByText("Robots.txt", { exact: true })).toBeVisible();
    await expect(page.getByText("RSS Feed", { exact: true })).toBeVisible();
    await expect(page.getByText("LLMs.txt", { exact: true })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Feature: Admin AI settings page
// ---------------------------------------------------------------------------

test.describe("Feature: Admin AI settings page", () => {
  test("Given /admin/ai-settings is requested, When I open it, Then the h1 (AI 设置) and the 服务商 & 模型 card with provider select are visible", async ({
    page,
  }) => {
    await page.goto("/admin/ai-settings", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/ai-settings");

    // AdminShell h1 — i18n key "admin.page.ai-settings" → "AI 设置".
    await expect(
      page.getByRole("heading", { level: 1, name: "AI 设置" }),
    ).toBeVisible({ timeout: 10_000 });
    // AiSettingsProviderCard h2 (provider-card.tsx:31).
    await expect(
      page.getByRole("heading", { level: 2, name: "服务商 & 模型" }),
    ).toBeVisible();
    // The provider <Select> renders the literal placeholder "请选择服务商"
    // as its first <option> (provider-card.tsx:43).
    const providerSelect = page.locator("select").first();
    await expect(providerSelect).toBeVisible();
    await expect(
      providerSelect.locator('option[value=""]'),
    ).toHaveText("请选择服务商");
  });

  test("Given the first non-empty provider option is actively selected, When the form re-renders, Then the 认证 card with an API Key password input is visible", async ({
    page,
  }) => {
    await page.goto("/admin/ai-settings", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/ai-settings");

    // Provider <Select> — first <select> on the page is the provider one
    // (AiSettingsProviderCard renders before the conditional model Select).
    const providerSelect = page.locator("select").first();
    const providerValues = await providerSelect
      .locator("option")
      .evaluateAll((opts) =>
        (opts as HTMLOptionElement[])
          .map((o) => o.value)
          .filter((v) => v !== ""),
      );
    // emptyDataGate only justifies a skip if the provider list is genuinely
    // empty — a defect the test should surface, not silently pass.
    test.skip(
      providerValues.length === 0,
      "AI provider <select> exposed zero non-empty options (provider list misconfigured).",
    );
    await providerSelect.selectOption(providerValues[0]);

    // ai-settings-form.tsx:132-151 — once `provider` is truthy, the 认证
    // card with the password Input becomes visible.
    await expect(
      page.getByRole("heading", { level: 2, name: "认证" }),
    ).toBeVisible({ timeout: 10_000 });
    // CSS attribute selector: the <Input type="password"> has no role/testid;
    // type=password is the stable identifier for the API Key input.
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("Given the first non-empty provider option is actively selected, When the form re-renders, Then a 模型 control (select or text input) is visible", async ({
    page,
  }) => {
    await page.goto("/admin/ai-settings", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/ai-settings");

    const providerSelect = page.locator("select").first();
    const providerValues = await providerSelect
      .locator("option")
      .evaluateAll((opts) =>
        (opts as HTMLOptionElement[])
          .map((o) => o.value)
          .filter((v) => v !== ""),
      );
    test.skip(
      providerValues.length === 0,
      "AI provider <select> exposed zero non-empty options (provider list misconfigured).",
    );
    await providerSelect.selectOption(providerValues[0]);

    // The 模型 label always renders inside the provider card after selection
    // (provider-card.tsx:54). The control underneath is either a <Select>
    // (when the provider has a model catalog) or a text <Input> (otherwise) —
    // both branches are valid per provider-card.tsx:61-86.
    await expect(page.getByText("模型", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    // CSS tag/attribute selector: model control has no role/testid. The
    // provider <select> is index 0; if a second select exists it is the
    // model select; otherwise the model is a text input.
    const modelControl = page
      .locator('select, input[type="text"]')
      .nth(1)
      .or(page.locator("select").nth(1));
    await expect(modelControl.first()).toBeVisible();
  });

  test("Given the first non-empty provider option is actively selected, When the form re-renders, Then the 保存设置 and 测试连接 buttons are visible", async ({
    page,
  }) => {
    await page.goto("/admin/ai-settings", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/ai-settings");

    const providerSelect = page.locator("select").first();
    const providerValues = await providerSelect
      .locator("option")
      .evaluateAll((opts) =>
        (opts as HTMLOptionElement[])
          .map((o) => o.value)
          .filter((v) => v !== ""),
      );
    test.skip(
      providerValues.length === 0,
      "AI provider <select> exposed zero non-empty options (provider list misconfigured).",
    );
    await providerSelect.selectOption(providerValues[0]);

    // ai-settings-form.tsx:172-186 — both buttons are gated on `provider`.
    await expect(
      page.getByRole("button", { name: "保存设置" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("button", { name: "测试连接" }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Feature: Admin site identity page
// ---------------------------------------------------------------------------

test.describe("Feature: Admin site identity page", () => {
  test("Given /admin/site-identity is requested, When I open it, Then the AdminShell h1 (站点身份) is visible", async ({
    page,
  }) => {
    await page.goto("/admin/site-identity", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/site-identity");

    await expect(
      page.getByRole("heading", { level: 1, name: "站点身份" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/site-identity renders, When I view it, Then the 站点信息 card exposes a 站点名称 label and text input", async ({
    page,
  }) => {
    await page.goto("/admin/site-identity", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/site-identity");

    // site-identity-form.tsx:76-90 — 站点信息 card h2 + 站点名称 label paired
    // with an <Input> (defaults to type="text"). Labels have no for/id link,
    // so structural locator on the placeholder "我的博客".
    await expect(
      page.getByRole("heading", { level: 2, name: "站点信息" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("站点名称")).toBeVisible();
    await expect(page.locator('input[placeholder="我的博客"]')).toBeVisible();
  });

  test("Given /admin/site-identity renders, When I view it, Then the 标语 label and its text input are visible", async ({
    page,
  }) => {
    await page.goto("/admin/site-identity", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/site-identity");

    // site-identity-form.tsx:92-104 — 标语 label paired with Input whose
    // placeholder is "一个关于……的个人博客".
    await expect(page.getByText("标语", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.locator('input[placeholder="一个关于……的个人博客"]'),
    ).toBeVisible();
  });

  test("Given /admin/site-identity renders, When I view it, Then the 站点图标 card exposes 上传图标 and a file input", async ({
    page,
  }) => {
    await page.goto("/admin/site-identity", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/site-identity");

    // site-logo-card.tsx:98 — 站点图标 h2 heading.
    await expect(
      page.getByRole("heading", { level: 2, name: "站点图标" }),
    ).toBeVisible({ timeout: 10_000 });
    // 上传图标 label copy (site-logo-card.tsx:143). The actual <input
    // type="file"> is sr-only; assert it is attached (not visible) since the
    // sr-only class hides it from the AT-tree.
    await expect(page.getByText("上传图标")).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeAttached();
  });

  test("Given /admin/site-identity renders, When I scroll, Then the 社交链接 card and + 添加链接 trigger are visible", async ({
    page,
  }) => {
    await page.goto("/admin/site-identity", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/site-identity");

    // SocialLinksCard is always rendered (site-identity-form.tsx:176).
    // It may be below the fold, so scroll it into view before asserting.
    const heading = page.getByRole("heading", {
      level: 2,
      name: "社交链接",
    });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible({ timeout: 10_000 });
    // The "+ 添加链接" trigger is a <button> (social-links-card.tsx:117).
    await expect(
      page.getByRole("button", { name: "+ 添加链接" }),
    ).toBeVisible();
  });

  test("Given /admin/site-identity renders, When I scroll to the bottom, Then the 保存设置 button is visible", async ({
    page,
  }) => {
    await page.goto("/admin/site-identity", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/site-identity");

    // site-identity-form.tsx:188-190 — final form footer save button.
    const saveButton = page.getByRole("button", { name: "保存设置" });
    await saveButton.scrollIntoViewIfNeeded();
    await expect(saveButton).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Feature: Admin system monitor page
// ---------------------------------------------------------------------------

test.describe("Feature: Admin system monitor page", () => {
  test("Given /admin/system is requested, When I open it, Then the AdminShell h1 (系统监控) is visible", async ({
    page,
  }) => {
    await page.goto("/admin/system", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/system");

    // AdminShell h1 — i18n key "admin.page.system" → "系统监控".
    await expect(
      page.getByRole("heading", { level: 1, name: "系统监控" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /admin/system renders the dashboard, When I view it, Then the four StatCard labels (堆内存使用 / RSS（总内存） / 峰值 / 平均 / 运行时间) are visible", async ({
    page,
  }) => {
    await page.goto("/admin/system", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/system");

    // system-monitor-dashboard.tsx:83-113 renders four StatCard tiles. After
    // /api/system/memory resolves, the loading skeleton is replaced with the
    // dashboard. Use generous timeout since the fetch is real.
    //
    // exact: true on every label — the StatCard <div> only contains the label
    // string (Icon contributes no accessible text), so exact matches. The
    // recommendation panel (system-monitor-helpers.tsx:143,146) renders <li>
    // copy like "堆内存使用率偏高（>70%）。…" which is NOT exact-equal to
    // "堆内存使用" and is therefore correctly filtered out. Without exact, a
    // warning recommendation triggers strict-mode violations on this scenario.
    await expect(
      page.getByText("堆内存使用", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText("RSS（总内存）", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("峰值 / 平均", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("运行时间", { exact: true }),
    ).toBeVisible();
  });

  test("Given /admin/system renders the dashboard, When I view it, Then the 刷新 button is visible", async ({
    page,
  }) => {
    await page.goto("/admin/system", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/system");

    // system-monitor-dashboard.tsx:73-80 — refresh trigger is a <button> with
    // RefreshCw icon and literal "刷新" copy.
    await expect(
      page.getByRole("button", { name: /刷新/ }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Given /admin/system renders the dashboard, When I view the chart card, Then the 内存使用趋势（48小时） heading is visible and either the recharts container or the 已采集 N 个样本 fallback is shown", async ({
    page,
  }) => {
    await page.goto("/admin/system", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/system");

    // system-monitor-chart.tsx:45-48 — card header always renders this h3
    // regardless of whether there is chart data.
    await expect(
      page.getByRole("heading", { level: 3, name: /内存使用趋势.*48小时/ }),
    ).toBeVisible({ timeout: 15_000 });

    // Data-state branch (system-monitor-chart.tsx:51-134):
    //   - chartData.length > 1 → <ResponsiveContainer> renders a recharts SVG.
    //   - else → "已采集 N 个样本" fallback text in the card body.
    // Exactly one branch is visible; assert that at least one is.
    const chartContainer = page.locator(".recharts-responsive-container");
    const fallback = page.getByText(/已采集 \d+ 个样本/);
    const chartCount = await chartContainer.count();
    const fallbackCount = await fallback.count();
    expect(
      chartCount + fallbackCount,
      "chart card rendered neither the recharts container nor the empty-state fallback",
    ).toBeGreaterThan(0);
    if (chartCount > 0) {
      await expect(chartContainer.first()).toBeVisible();
    } else {
      await expect(fallback.first()).toBeVisible();
    }
  });
});
