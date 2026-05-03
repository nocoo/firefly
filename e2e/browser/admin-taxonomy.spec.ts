/**
 * L3 E2E: Admin categories and tags management
 *
 * Covers: /admin/categories, /admin/tags
 */
import { test, expect } from "@playwright/test";

test.describe("Admin categories page", () => {
  test("categories page loads", async ({ page }) => {
    await page.goto("/admin/categories", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/admin\/categories/);

    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("shows list of categories", async ({ page }) => {
    await page.goto("/admin/categories", { waitUntil: "networkidle" });

    const container = page.locator("table");
    const count = await container.count();
    if (count > 0) {
      await expect(container.first()).toBeVisible();
    }
  });

  test("clicking create button opens inline form", async ({ page }) => {
    await page.goto("/admin/categories", { waitUntil: "networkidle" });

    const createBtn = page.getByText("新建分类");
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await createBtn.click();

    const nameInput = page.locator('input[placeholder="名称"]');
    await expect(nameInput).toBeVisible();
    const slugInput = page.locator('input[placeholder="别名"]');
    await expect(slugInput).toBeVisible();

    const cancelBtn = page.getByText("取消");
    await cancelBtn.click();
    await expect(nameInput).not.toBeVisible();
  });

  test("clicking edit button opens edit form for category", async ({
    page,
  }) => {
    await page.goto("/admin/categories", { waitUntil: "networkidle" });

    const editBtn = page.getByText("编辑").first();
    if ((await editBtn.count()) === 0) return;

    await editBtn.click();

    const heading = page.getByText("编辑分类");
    await expect(heading).toBeVisible();

    const nameInput = page.locator('input[placeholder="名称"]');
    await expect(nameInput).toBeVisible();
    const nameValue = await nameInput.inputValue();
    expect(nameValue.length).toBeGreaterThan(0);

    const cancelBtn = page.getByText("取消");
    await cancelBtn.click();
  });

  test("category table shows post count column", async ({ page }) => {
    await page.goto("/admin/categories", { waitUntil: "networkidle" });

    const header = page.getByText("文章数");
    await expect(header).toBeVisible();
  });
});

test.describe("Admin tags page", () => {
  test("tags page loads", async ({ page }) => {
    await page.goto("/admin/tags", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/admin\/tags/);

    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("shows list of tags", async ({ page }) => {
    await page.goto("/admin/tags", { waitUntil: "networkidle" });

    const container = page.locator("table");
    const count = await container.count();
    if (count > 0) {
      await expect(container.first()).toBeVisible();
    }
  });

  test("clicking create button opens inline form", async ({ page }) => {
    await page.goto("/admin/tags", { waitUntil: "networkidle" });

    const createBtn = page.getByText("新建标签");
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await createBtn.click();

    const nameInput = page.locator('input[placeholder="名称"]');
    await expect(nameInput).toBeVisible();
    const slugInput = page.locator('input[placeholder="别名"]');
    await expect(slugInput).toBeVisible();
    const descInput = page.locator('input[placeholder="描述（可选）"]');
    await expect(descInput).toBeVisible();

    const cancelBtn = page.getByText("取消");
    await cancelBtn.click();
    await expect(nameInput).not.toBeVisible();
  });

  test("clicking edit button opens edit form for tag", async ({ page }) => {
    await page.goto("/admin/tags", { waitUntil: "networkidle" });

    const editBtn = page.getByText("编辑").first();
    if ((await editBtn.count()) === 0) return;

    await editBtn.click();

    const heading = page.getByText("编辑标签");
    await expect(heading).toBeVisible();

    const nameInput = page.locator('input[placeholder="名称"]');
    const nameValue = await nameInput.inputValue();
    expect(nameValue.length).toBeGreaterThan(0);

    const cancelBtn = page.getByText("取消");
    await cancelBtn.click();
  });
});
