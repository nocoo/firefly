/**
 * L2 API E2E — Tags endpoints
 *
 * Covers: GET /api/tags, GET /api/tags/[slug]
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17043";

describe("GET /api/tags", () => {
  it("returns list of tags", async () => {
    const res = await fetch(`${BASE}/api/tags`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

describe("GET /api/tags/[slug]", () => {
  it("returns 404 for non-existent slug", async () => {
    const res = await fetch(`${BASE}/api/tags/nonexistent-tag-xyz`);
    expect(res.status).toBe(404);
  });

  it("returns a tag by slug (after creating one)", async () => {
    const slug = `e2e-tag-${Date.now()}`;

    // Create via POST
    const createRes = await fetch(`${BASE}/api/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "E2E Tag", slug }),
    });
    expect(createRes.status).toBe(201);

    // Fetch by slug
    const getRes = await fetch(`${BASE}/api/tags/${slug}`);
    expect(getRes.status).toBe(200);

    const body = await getRes.json();
    expect(body.slug).toBe(slug);
    expect(body.name).toBe("E2E Tag");

    // Cleanup
    await fetch(`${BASE}/api/tags/${slug}`, { method: "DELETE" });
  });
});
