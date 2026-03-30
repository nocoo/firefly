/**
 * L2 API E2E — Settings endpoints
 *
 * Covers: GET /api/settings, PUT /api/settings
 *
 * Note: GET /api/settings is not proxy-protected (proxy only guards POST/PUT/DELETE/PATCH).
 * PUT /api/settings IS proxy-protected but E2E_SKIP_AUTH=true bypasses it.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

describe("GET /api/settings", () => {
  it("returns site settings", async () => {
    const res = await fetch(`${BASE}/api/settings`);
    expect(res.status).toBe(200);

    const body = await res.json();
    // Settings should have locale and postsPerPage at minimum
    expect(body).toHaveProperty("locale");
    expect(body).toHaveProperty("postsPerPage");
  });
});

describe("PUT /api/settings", () => {
  it("updates postsPerPage setting", async () => {
    // Read current value
    const getRes = await fetch(`${BASE}/api/settings`);
    const original = await getRes.json();

    // Update to a different value
    const newValue = original.postsPerPage === 10 ? 15 : 10;
    const putRes = await fetch(`${BASE}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postsPerPage: newValue }),
    });
    expect(putRes.status).toBe(200);

    const updated = await putRes.json();
    expect(updated.postsPerPage).toBe(newValue);

    // Restore original value
    await fetch(`${BASE}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postsPerPage: original.postsPerPage }),
    });
  });

  it("rejects invalid locale", async () => {
    const res = await fetch(`${BASE}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "invalid-locale-xyz" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects non-integer postsPerPage", async () => {
    const res = await fetch(`${BASE}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postsPerPage: "not-a-number" }),
    });
    expect(res.status).toBe(400);
  });
});
