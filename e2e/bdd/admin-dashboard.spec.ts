/**
 * L4 Smoke: Admin dashboard shell, stats cards, and sidebar navigation.
 */
import { test, expect, expectPathname } from "./fixtures";

test.describe("Admin dashboard smoke", () => {
  test("Dashboard renders 概览 heading, stats cards, and sign-out control", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin");
    await expect(page.getByRole("heading", { level: 1, name: "概览" }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("paragraph").filter({ hasText: "已发布文章" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("paragraph").filter({ hasText: /^分类$/ })).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: /^标签$/ })).toBeVisible();

    const sidebar = page.getByRole("complementary").first();
    await expect(sidebar.getByRole("button", { name: "退出登录", exact: true })).toBeVisible();
  });

  test("Sidebar navigates from /admin to /admin/posts", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "networkidle" });
    const sidebarNav = page.getByRole("complementary").first().getByRole("navigation").first();
    await sidebarNav.getByRole("button", { name: "文章", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/posts$/);
    await expect(sidebarNav.getByRole("button", { name: "文章", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
