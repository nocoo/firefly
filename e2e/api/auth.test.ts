/**
 * L2 API E2E — Auth bypass & write-protection verification
 *
 * The E2E server runs with E2E_SKIP_AUTH=true, so we cannot test 401
 * rejection within this suite. Instead we verify:
 *
 * 1. Auth bypass allows write operations (confirms proxy bypass works)
 * 2. Admin routes are accessible via bypass (confirms they are auth-gated)
 *
 * True 401/redirect rejection is tested by L1 unit tests on the proxy
 * logic (isProtectedRoute, isProtectedApiRoute) and by manual testing
 * against a server without E2E_SKIP_AUTH.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17043";

describe("Auth bypass — admin routes", () => {
  it("GET /admin is accessible with E2E_SKIP_AUTH=true", async () => {
    const res = await fetch(`${BASE}/admin`, { redirect: "manual" });
    // With bypass, admin should be accessible (200 or 307/308 to sub-page)
    expect([200, 307, 308]).toContain(res.status);
  });

  it("GET /admin/posts is accessible with E2E_SKIP_AUTH=true", async () => {
    const res = await fetch(`${BASE}/admin/posts`, { redirect: "manual" });
    expect([200, 307, 308]).toContain(res.status);
  });
});

describe("Auth bypass — write API endpoints", () => {
  it("POST /api/posts succeeds with auth bypass", async () => {
    const slug = `auth-bypass-test-${Date.now()}`;
    const res = await fetch(`${BASE}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Auth Bypass Test",
        slug,
        content: "Verifies E2E_SKIP_AUTH lets writes through",
        status: "draft",
      }),
    });
    expect(res.status).toBe(201);

    // Cleanup
    await fetch(`${BASE}/api/posts/${slug}`, { method: "DELETE" });
  });

  it("PUT /api/settings succeeds with auth bypass", async () => {
    const getRes = await fetch(`${BASE}/api/settings`);
    expect(getRes.status).toBe(200);
    const settings = await getRes.json();

    const res = await fetch(`${BASE}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postsPerPage: settings.postsPerPage }),
    });
    expect(res.status).toBe(200);
  });

  it("DELETE /api/posts/[slug] succeeds with auth bypass", async () => {
    // Create a post to delete
    const slug = `auth-delete-test-${Date.now()}`;
    await fetch(`${BASE}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Auth Delete Test",
        slug,
        content: "Will be deleted",
        status: "draft",
      }),
    });

    const res = await fetch(`${BASE}/api/posts/${slug}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
  });
});

describe("Auth guard — read-only API is unprotected", () => {
  it("GET /api/posts is accessible without auth (public endpoint)", async () => {
    const res = await fetch(`${BASE}/api/posts`);
    // GET on API routes is NOT protected by the auth guard,
    // so this works regardless of E2E_SKIP_AUTH
    expect(res.status).toBe(200);
  });

  it("GET /api/settings is accessible without auth", async () => {
    const res = await fetch(`${BASE}/api/settings`);
    expect(res.status).toBe(200);
  });
});
