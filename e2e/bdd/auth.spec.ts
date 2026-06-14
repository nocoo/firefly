/**
 * L3 BDD: Login page rendering and admin auth guard with E2E bypass.
 *
 * Phase 2.1 of L3 → BDD migration (see docs/25-l3-bdd-refactor.md §3, §4.2).
 *
 * Source spec attribution (13 → 13 scenarios):
 *   - browser/login-auth.spec.ts (13 tests)
 *
 * Mapping (old test → new scenario):
 *   browser/login-auth.spec.ts "login page loads"
 *       → "Given /login is requested, ... I land on /login or am redirected to /admin"
 *   browser/login-auth.spec.ts "login page shows Firefly branding"
 *       → "Given the login page renders, ... I see Firefly branding (avatar logo)"
 *   browser/login-auth.spec.ts "login page shows welcome message"
 *       → "Given the login page renders, ... I see the 欢迎回来 welcome copy"
 *   browser/login-auth.spec.ts "login page has Google sign-in button"
 *       → "Given the login page renders, ... I see the Google sign-in button"
 *   browser/login-auth.spec.ts "login page has theme toggle"
 *       → "Given the login page renders, ... the theme toggle is visible"
 *   browser/login-auth.spec.ts "login page has GitHub link"
 *       → "Given the login page renders, ... the GitHub repo link is visible"
 *   browser/login-auth.spec.ts "login page shows footer"
 *       → "Given the login page renders, ... the page footer is visible"
 *   browser/login-auth.spec.ts "login page shows security indicator"
 *       → "Given the login page renders, ... the 安全认证 security indicator is visible"
 *   browser/login-auth.spec.ts "login page shows error message for access denied"
 *       → "Given /login?error=AccessDenied is requested, ... the access-denied copy appears (when not bypassed)"
 *   browser/login-auth.spec.ts "login page preserves callback URL"
 *       → "Given /login?callbackUrl=/admin/posts, ... the callbackUrl is honored (in URL or in redirect target)"
 *   browser/login-auth.spec.ts "admin pages are accessible with E2E auth bypass"
 *       → "Given E2E auth bypass is active, ... /admin renders the admin shell"
 *   browser/login-auth.spec.ts "admin/posts accessible with auth bypass"
 *       → "Given E2E auth bypass is active, ... /admin/posts renders without redirecting to login"
 *   browser/login-auth.spec.ts "admin/settings accessible with auth bypass"
 *       → "Given E2E auth bypass is active, ... /admin/settings renders without redirecting to login"
 *
 * Notes on E2E auth bypass and dual-branch assertions:
 *   The L3 runner sets `E2E_SKIP_AUTH=1`, so `auth()` returns a mock session
 *   and /login redirects via `redirect(callbackUrl)` before LoginCard ever
 *   renders. The login-page scenarios therefore have two legitimate landings:
 *   - bypass active → URL becomes /admin (or callbackUrl) → page-element
 *     assertions are surfaced as Playwright skips via `emptyDataGate`, so
 *     reports show the branch explicitly instead of silently passing.
 *   - bypass inactive (login HTML actually served) → element assertions run.
 *   Either way the URL must resolve to /login or /admin; any other landing
 *   (500, foreign route) fails the scenario instead of being skipped.
 */
import { test, expect, emptyDataGate, expectPathname } from "./fixtures";

// ---------------------------------------------------------------------------
// Helpers (local — narrow scope, see fixtures.ts policy)
// ---------------------------------------------------------------------------

interface LoginBranch {
  landed: "login" | "admin";
  url: string;
}

/**
 * Visit a /login route and classify the landing branch. The auth-bypass
 * branch is the redirect target (/admin or callbackUrl); the page branch is
 * /login itself. Any other path fails the scenario.
 *
 * Path-level comparison (not substring): a foreign URL whose path happens
 * to contain "/login" or "/admin" as a fragment (e.g. /redirect?next=/admin)
 * would slip through a substring guard and silently classify as the wrong
 * branch.
 */
async function visitLogin(
  page: import("@playwright/test").Page,
  query = "",
): Promise<LoginBranch> {
  await page.goto(`/login${query}`, { waitUntil: "networkidle" });
  const { pathname } = new URL(page.url());
  // Strict path guard: /login (page rendered) or /admin* (bypass redirect).
  // Anything else (500, foreign route, oauth callback fragment) should fail.
  const isLogin = pathname === "/login";
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  expect(isLogin || isAdmin, `unexpected landing pathname: ${pathname}`).toBe(
    true,
  );
  return { landed: isLogin ? "login" : "admin", url: page.url() };
}

// ---------------------------------------------------------------------------
// Feature: Login page rendering
// ---------------------------------------------------------------------------

test.describe("Feature: Login page rendering", () => {
  test("Given /login is requested, When I open it, Then I land on /login or am redirected to /admin", async ({
    page,
  }) => {
    // Given/When: hit /login with no params
    const branch = await visitLogin(page);

    // Then: explicit per-branch assertion (no silent pass)
    if (branch.landed === "admin") {
      // Auth-bypass redirect: must have landed on the default admin path.
      expect(branch.url).toMatch(/\/admin(\/|$|\?)/);
    } else {
      // Login page actually rendered: <body> must be present and visible.
      // CSS tag selector: <body> has no role/label/testid and we only need
      // to confirm the document mounted, not any specific landmark.
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("Given the login page renders, When I view it, Then I see Firefly branding (avatar logo)", async ({
    page,
  }) => {
    // Given/When: visit /login
    const branch = await visitLogin(page);
    const gate = emptyDataGate(
      branch.landed === "login" ? 1 : 0,
      "login page render (E2E auth bypass redirected to /admin)",
    );
    test.skip(gate.skip, gate.reason);

    // Then: the Firefly avatar image is visible. LoginCard renders two <img>
    // tags with alt="Firefly" (the header strip badge and the badge avatar).
    // CSS attribute selector: <img> exposes no role for graphics-only logos,
    // and the alt text is the stable identifier of the branding asset.
    await expect(page.locator('img[alt="Firefly"]').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("Given the login page renders, When I view it, Then I see the 欢迎回来 welcome copy", async ({
    page,
  }) => {
    // Given/When: visit /login
    const branch = await visitLogin(page);
    const gate = emptyDataGate(
      branch.landed === "login" ? 1 : 0,
      "login page render (E2E auth bypass redirected to /admin)",
    );
    test.skip(gate.skip, gate.reason);

    // Then: welcome copy is visible. No semantic role applies to this <p>;
    // the literal copy is the stable identifier per LoginCard.
    await expect(page.getByText("欢迎回来")).toBeVisible({ timeout: 10_000 });
  });

  test("Given the login page renders, When I view it, Then I see the Google sign-in button", async ({
    page,
  }) => {
    // Given/When: visit /login
    const branch = await visitLogin(page);
    const gate = emptyDataGate(
      branch.landed === "login" ? 1 : 0,
      "login page render (E2E auth bypass redirected to /admin)",
    );
    test.skip(gate.skip, gate.reason);

    // Then: a button containing the literal "Google 登录" label is visible.
    // getByRole("button") narrows to <button>; name regex matches the
    // localized copy LoginCard renders ("使用 Google 登录").
    await expect(
      page.getByRole("button", { name: /Google/ }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given the login page renders, When I view it, Then the theme toggle is visible", async ({
    page,
  }) => {
    // Given/When: visit /login
    const branch = await visitLogin(page);
    const gate = emptyDataGate(
      branch.landed === "login" ? 1 : 0,
      "login page render (E2E auth bypass redirected to /admin)",
    );
    test.skip(gate.skip, gate.reason);

    // Then: ThemeToggle renders as a <button>. Its aria-label is localized
    // (Chinese: "切换主题（…）"), so use a role-based locator that matches
    // either the localized copy or any future English fallback.
    await expect(
      page.getByRole("button", { name: /切换主题|theme/i }),
    ).toBeVisible();
  });

  test("Given the login page renders, When I view it, Then the GitHub repo link is visible", async ({
    page,
  }) => {
    // Given/When: visit /login
    const branch = await visitLogin(page);
    const gate = emptyDataGate(
      branch.landed === "login" ? 1 : 0,
      "login page render (E2E auth bypass redirected to /admin)",
    );
    test.skip(gate.skip, gate.reason);

    // Then: the GitHub link is exposed via aria-label="GitHub repository"
    // (per LoginCard); use getByRole("link", { name }) for the semantic match.
    await expect(
      page.getByRole("link", { name: /GitHub repository/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given the login page renders, When I view it, Then the page footer is visible", async ({
    page,
  }) => {
    // Given/When: visit /login
    const branch = await visitLogin(page);
    const gate = emptyDataGate(
      branch.landed === "login" ? 1 : 0,
      "login page render (E2E auth bypass redirected to /admin)",
    );
    test.skip(gate.skip, gate.reason);

    // Then: the <footer> landmark is visible. getByRole("contentinfo") is
    // the ARIA role for <footer>.
    await expect(
      page.getByRole("contentinfo").first(),
    ).toBeVisible();
  });

  test("Given the login page renders, When I view it, Then the 安全认证 security indicator is visible", async ({
    page,
  }) => {
    // Given/When: visit /login
    const branch = await visitLogin(page);
    const gate = emptyDataGate(
      branch.landed === "login" ? 1 : 0,
      "login page render (E2E auth bypass redirected to /admin)",
    );
    test.skip(gate.skip, gate.reason);

    // Then: the "安全认证" copy in the badge footer strip is visible.
    // No role/testid applies; the localized copy is the stable identifier.
    await expect(page.getByText("安全认证")).toBeVisible();
  });

  test("Given /login?error=AccessDenied is requested, When the login page renders, Then the access-denied copy appears", async ({
    page,
  }) => {
    // Given/When: open /login with an AccessDenied error
    const branch = await visitLogin(page, "?error=AccessDenied");
    const gate = emptyDataGate(
      branch.landed === "login" ? 1 : 0,
      "login page render with ?error=AccessDenied (E2E auth bypass redirected to /admin; error UI cannot be exercised)",
    );
    test.skip(gate.skip, gate.reason);

    // Then: the localized AccessDenied copy from LoginCard is visible.
    await expect(
      page.getByText("您的账户未被授权访问此应用程序。"),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given /login?callbackUrl=/admin/posts, When I open it, Then the callbackUrl is honored in URL or redirect target", async ({
    page,
  }) => {
    // Given/When: visit /login with a callbackUrl query
    const branch = await visitLogin(page, "?callbackUrl=/admin/posts");

    // Then: per branch, the callback must be honored — not just present.
    if (branch.landed === "login") {
      // Login page actually rendered: the callbackUrl must round-trip in the
      // current URL (LoginCard reads it via useSearchParams).
      expect(branch.url).toMatch(
        /[?&]callbackUrl=(\/admin\/posts|%2Fadmin%2Fposts)/,
      );
    } else {
      // Auth-bypass redirect: page.tsx must have redirected to the callback
      // target itself, not to the default /admin.
      expect(branch.url).toMatch(/\/admin\/posts(\/|$|\?)/);
    }
  });
});

// ---------------------------------------------------------------------------
// Feature: Admin auth guard with E2E bypass
// ---------------------------------------------------------------------------

test.describe("Feature: Admin auth guard with E2E bypass", () => {
  test("Given E2E auth bypass is active, When I open /admin, Then it renders the admin shell without redirecting to login", async ({
    page,
  }) => {
    // Given/When: visit /admin
    await page.goto("/admin", { waitUntil: "networkidle" });

    // Then: pathname is exactly /admin (not /login?callbackUrl=/admin)
    await expectPathname(page, "/admin");

    // Then: the AdminShell page-title <h1> is visible (semantic landmark).
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Given E2E auth bypass is active, When I open /admin/posts, Then it renders without redirecting to login", async ({
    page,
  }) => {
    await page.goto("/admin/posts", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/posts");
  });

  test("Given E2E auth bypass is active, When I open /admin/settings, Then it renders without redirecting to login", async ({
    page,
  }) => {
    await page.goto("/admin/settings", { waitUntil: "networkidle" });
    await expectPathname(page, "/admin/settings");
  });
});
