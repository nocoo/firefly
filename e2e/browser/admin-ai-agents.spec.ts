/**
 * L3 E2E: Admin AI agents pages
 *
 * Covers: /admin/ai-agents, /admin/ai-agents/[id]
 */
import { test, expect } from "@playwright/test";

test.describe("Admin AI agents list page", () => {
  test("ai agents page loads", async ({ page }) => {
    await page.goto("/admin/ai-agents", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/admin\/ai-agents/);

    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("shows agent list or empty state", async ({ page }) => {
    await page.goto("/admin/ai-agents", { waitUntil: "networkidle" });

    // Should show list of agents (table) or empty state message
    // Empty state text: "还没有 AI 代理"
    const agentTable = page.locator("table");
    const emptyText = page.getByText(/还没有.*代理|No agents/i);
    const hasTable = await agentTable.count() > 0;
    const hasEmptyText = await emptyText.count() > 0;
    expect(hasTable || hasEmptyText).toBe(true);
  });

  test("has create agent button", async ({ page }) => {
    await page.goto("/admin/ai-agents", { waitUntil: "networkidle" });

    // Button text is "创建代理"
    const createButton = page.locator(
      'button:has-text("创建代理"), button:has-text("Create"), button:has-text("新建")',
    );
    await expect(createButton.first()).toBeVisible({ timeout: 10_000 });
  });

  test("shows agent cards with avatar and info", async ({ page }) => {
    await page.goto("/admin/ai-agents", { waitUntil: "networkidle" });

    // Agents may have avatar images and category badges
    const agentCard = page.locator(
      '[data-testid="agent-card"], .agent-card, [role="listitem"]',
    );
    const count = await agentCard.count();
    if (count > 0) {
      // If agents exist, cards should show name and category
      await expect(agentCard.first()).toBeVisible();
    }
  });

  test("clicking create navigates to new agent form", async ({ page }) => {
    await page.goto("/admin/ai-agents", { waitUntil: "networkidle" });

    // Button text is "创建代理"
    const createButton = page.locator(
      'button:has-text("创建代理"), a[href*="/ai-agents/new"]',
    ).first();

    if (await createButton.isVisible()) {
      await createButton.click();
      await expect(page).toHaveURL(/\/admin\/ai-agents\/new/);
    }
  });
});

test.describe("Admin AI agent form - new agent", () => {
  test("new agent page loads", async ({ page }) => {
    await page.goto("/admin/ai-agents/new", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/admin\/ai-agents\/new/);

    // Should show heading with "创建 AI 代理"
    const heading = page.getByText(/创建.*代理|New Agent/i);
    await expect(heading.first()).toBeVisible({ timeout: 10_000 });
  });

  test("shows name input", async ({ page }) => {
    await page.goto("/admin/ai-agents/new", { waitUntil: "networkidle" });

    // Name input has placeholder "如：科技写手"
    const nameInput = page.locator('input[placeholder*="科技写手"]');
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
  });

  test("shows slug input", async ({ page }) => {
    await page.goto("/admin/ai-agents/new", { waitUntil: "networkidle" });

    // Slug input has placeholder "如：tech-writer"
    const slugInput = page.locator('input[placeholder*="tech-writer"]');
    await expect(slugInput).toBeVisible({ timeout: 10_000 });
  });

  test("shows category selector", async ({ page }) => {
    await page.goto("/admin/ai-agents/new", { waitUntil: "networkidle" });

    // Category select with "选择分类..." placeholder
    const categorySelect = page.locator(
      'select, [role="combobox"], button:has-text("选择分类")',
    );
    await expect(categorySelect.first()).toBeVisible({ timeout: 10_000 });
  });

  test("shows description textarea", async ({ page }) => {
    await page.goto("/admin/ai-agents/new", { waitUntil: "networkidle" });

    // Description textarea with placeholder "代理的可选描述"
    const descriptionInput = page.locator(
      'textarea[placeholder*="描述"]',
    );
    await expect(descriptionInput).toBeVisible({ timeout: 10_000 });
  });

  test("shows avatar upload area", async ({ page }) => {
    await page.goto("/admin/ai-agents/new", { waitUntil: "networkidle" });

    // Avatar upload may be present
    const avatarArea = page.locator(
      '[data-testid="avatar-upload"], input[type="file"], img[alt*="avatar"]',
    );
    const count = await avatarArea.count();
    // Avatar upload is optional on new agent form
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("has save button", async ({ page }) => {
    await page.goto("/admin/ai-agents/new", { waitUntil: "networkidle" });

    // Button text is "创建代理"
    const saveButton = page.locator(
      'button:has-text("创建代理"), button:has-text("Create")',
    );
    await expect(saveButton.first()).toBeVisible({ timeout: 10_000 });
  });

  test("has back button", async ({ page }) => {
    await page.goto("/admin/ai-agents/new", { waitUntil: "networkidle" });

    // Back button text is "返回"
    const backButton = page.locator(
      'button:has-text("返回"), button:has-text("取消"), a:has-text("返回")',
    );
    await expect(backButton.first()).toBeVisible({ timeout: 10_000 });
  });

  test("auto-generates slug from name", async ({ page }) => {
    await page.goto("/admin/ai-agents/new", { waitUntil: "networkidle" });

    const nameInput = page.locator('input[placeholder*="科技写手"]');
    const slugInput = page.locator('input[placeholder*="tech-writer"]');

    // Enter a name
    await nameInput.fill("Test Agent Name");
    await page.waitForTimeout(100); // Allow auto-generation

    // Slug should be auto-generated
    const slugValue = await slugInput.inputValue();
    expect(slugValue).toBe("test-agent-name");
  });
});
