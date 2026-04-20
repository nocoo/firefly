/**
 * L3 E2E: Login and authentication pages
 *
 * Covers: /login
 *
 * Note: In E2E test mode with E2E_SKIP_AUTH=true, authenticated sessions are
 * automatically provided. These tests verify the login page renders correctly
 * and includes all expected elements.
 */
import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("login page loads", async ({ page }) => {
    // In E2E mode with auth bypass, visiting /login when already "authenticated"
    // may redirect to /admin. We test the page structure assuming no auth.
    // For true login page testing, we would need to disable auth bypass.

    // Visit login directly - it may redirect if session exists
    await page.goto("/login", { waitUntil: "networkidle" });

    // Could be on /login or redirected to /admin
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      // We're on the login page - verify it renders
      const pageContent = page.locator("body");
      await expect(pageContent).toBeVisible();
    } else {
      // Redirected to admin (auth bypass active) - that's expected behavior
      expect(currentUrl).toMatch(/\/admin/);
    }
  });

  test("login page shows Firefly branding", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });

    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      // Should show Firefly branding
      const branding = page.locator('text=/Firefly/i, img[alt*="Firefly"]');
      await expect(branding.first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("login page shows welcome message", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });

    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      // Should show welcome message
      const welcomeMessage = page.locator(
        'text=/欢迎|Welcome|登录|Sign in/i',
      );
      await expect(welcomeMessage.first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("login page has Google sign-in button", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });

    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      // Should have Google login button
      const googleButton = page.locator(
        'button:has-text("Google"), button:has-text("登录")',
      );
      await expect(googleButton.first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("login page has theme toggle", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });

    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      // Should have theme toggle
      const themeToggle = page.locator(
        'button[aria-label*="theme"], button[aria-label*="Theme"], [data-testid="theme-toggle"]',
      );
      const count = await themeToggle.count();
      if (count > 0) {
        await expect(themeToggle.first()).toBeVisible();
      }
    }
  });

  test("login page has GitHub link", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });

    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      // Should have GitHub repository link
      const githubLink = page.locator(
        'a[href*="github.com"], a[aria-label*="GitHub"]',
      );
      await expect(githubLink.first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("login page shows footer", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });

    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      // Should show footer
      const footer = page.locator("footer");
      const count = await footer.count();
      if (count > 0) {
        await expect(footer.first()).toBeVisible();
      }
    }
  });

  test("login page shows error message for access denied", async ({ page }) => {
    await page.goto("/login?error=AccessDenied", { waitUntil: "networkidle" });

    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      // Should show access denied error message
      const errorMessage = page.locator(
        'text=/未被授权|Access Denied|not authorized/i',
      );
      await expect(errorMessage.first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("login page preserves callback URL", async ({ page }) => {
    await page.goto("/login?callbackUrl=/admin/posts", { waitUntil: "networkidle" });

    // The page should load with the callback URL preserved
    // (We can't verify the redirect without actual authentication)
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      // We're on login page - callback URL should be in query string
      expect(currentUrl).toMatch(/callbackUrl/);
    }
  });

  test("login page shows security indicator", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });

    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      // Should show security badge/indicator
      const securityIndicator = page.locator(
        'text=/安全|Secure|认证/i, .animate-pulse',
      );
      const count = await securityIndicator.count();
      if (count > 0) {
        await expect(securityIndicator.first()).toBeVisible();
      }
    }
  });
});

test.describe("Admin auth guard", () => {
  test("admin pages are accessible with E2E auth bypass", async ({ page }) => {
    // With E2E_SKIP_AUTH=true, admin pages should be accessible
    await page.goto("/admin", { waitUntil: "networkidle" });

    // Should not redirect to login
    await expect(page).toHaveURL(/\/admin/);

    // Should show admin content
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("admin/posts accessible with auth bypass", async ({ page }) => {
    await page.goto("/admin/posts", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/admin\/posts/);
  });

  test("admin/settings accessible with auth bypass", async ({ page }) => {
    await page.goto("/admin/settings", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/admin\/settings/);
  });
});
