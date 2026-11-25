/**
 * L4 Smoke: Admin posts list, new post editor, edit post form, and 404 guard.
 */
import type { Page } from "@playwright/test";
import { test, expect, expectPathname, seedPostIdempotent } from "./fixtures";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:27028";
const NOW_EPOCH = Math.floor(Date.now() / 1000);

async function gotoAdminPostsList(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("firefly_posts_view_mode", "list");
  });
  await page.goto("/admin/posts", { waitUntil: "networkidle" });
  await expectPathname(page, "/admin/posts");
}

test.describe("Admin posts smoke", () => {
  test.beforeAll(async () => {
    await seedPostIdempotent(BASE, {
      title: "E2E Admin Posts Smoke",
      slug: `e2e-admin-posts-smoke-${Date.now()}`,
      content: "Admin smoke post body.",
      status: "published",
      published_at: NOW_EPOCH,
    });
  });

  test("Posts list renders table and 新建文章 link navigates to /admin/posts/new", async ({
    page,
  }) => {
    await gotoAdminPostsList(page);
    await expect(page.getByRole("heading", { level: 1, name: "文章" }).first()).toBeVisible({
      timeout: 10_000,
    });
    const table = page.getByRole("table");
    await expect(table).toBeVisible({ timeout: 10_000 });
    await expect(table.getByRole("link", { name: /编辑/ }).first()).toBeVisible();

    const newLink = page.getByRole("link", { name: "新建文章", exact: true });
    await expect(newLink).toBeVisible();
    await newLink.click();
    await page.waitForURL("**/admin/posts/new", { timeout: 10_000 });
    await expectPathname(page, "/admin/posts/new");
  });

  test("New post editor renders fields, action buttons, and syncs slug from title", async ({
    page,
  }) => {
    await page.goto("/admin/posts/new", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/posts/new");
    await expect(page.getByRole("heading", { level: 1, name: "新建文章" }).first()).toBeVisible({
      timeout: 10_000,
    });

    const contentArea = page.locator("textarea#content-mobile, textarea#content-desktop");
    await expect(contentArea.first()).toBeAttached();

    const form = page.locator("form");
    await expect(form.getByRole("button", { name: "创建文章", exact: true })).toBeVisible();
    await expect(form.getByRole("button", { name: "取消", exact: true })).toBeVisible();
    await expect(form.getByRole("button", { name: "删除文章" })).toHaveCount(0);

    const ts = Date.now();
    const uniqueTitle = `E2E Admin Posts ${ts} Test`;
    await page.getByPlaceholder("文章标题").fill(uniqueTitle);
    await expect(page.getByPlaceholder("url-slug")).toHaveValue(`e2e-admin-posts-${ts}-test`);
  });

  test("Edit post form hydrates title, controls, and 取消 returns to /admin/posts", async ({
    page,
  }) => {
    await gotoAdminPostsList(page);
    const editLink = page
      .getByRole("table")
      .locator('a[href*="/admin/posts/"][href$="/edit"]')
      .first();
    await expect(editLink).toBeVisible({ timeout: 10_000 });
    await editLink.click();
    await page.waitForURL(/\/admin\/posts\/[^/]+\/edit/, { timeout: 10_000 });

    const titleInput = page.getByPlaceholder("文章标题");
    await expect(titleInput).toBeVisible({ timeout: 10_000 });
    expect((await titleInput.inputValue()).length).toBeGreaterThan(0);

    await expect(page.locator("#status")).toBeVisible();
    await expect(page.locator("#category")).toBeVisible();
    const form = page.locator("form");
    await expect(form.getByRole("button", { name: "更新文章", exact: true })).toBeVisible();
    await expect(form.getByRole("button", { name: "删除文章", exact: true })).toBeVisible();

    await form.getByRole("button", { name: "取消", exact: true }).click();
    await page.waitForURL("**/admin/posts", { timeout: 10_000 });
    await expectPathname(page, "/admin/posts");
  });

  test("Nil-uuid edit URL returns 404", async ({ page }) => {
    const response = await page.goto("/admin/posts/00000000-0000-0000-0000-000000000000/edit", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(404);
  });
});
