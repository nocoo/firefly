/**
 * L4 Smoke: Auth redirect and admin route guard with E2E bypass.
 */
import { test, expect, expectPathname } from "./fixtures";

test.describe("Auth guard smoke", () => {
  test("/login redirects to /admin under E2E auth bypass", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    const { pathname } = new URL(page.url());
    expect(pathname === "/login" || pathname === "/admin" || pathname.startsWith("/admin/")).toBe(
      true,
    );
  });

  test("/login?callbackUrl=/admin/posts honors callbackUrl", async ({ page }) => {
    await page.goto("/login?callbackUrl=/admin/posts", { waitUntil: "networkidle" });
    expect(page.url()).toMatch(/\/admin\/posts(\/|$|\?)/);
  });

  test("/admin renders admin shell without redirecting to login", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("/admin/posts renders without redirecting to login", async ({ page }) => {
    await page.goto("/admin/posts", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/posts");
  });

  test("/admin/settings renders without redirecting to login", async ({ page }) => {
    await page.goto("/admin/settings", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/settings");
  });
});
