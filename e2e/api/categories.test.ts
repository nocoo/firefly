/**
 * L2 API E2E — Categories endpoints
 *
 * Covers: GET /api/categories, GET /api/categories/[slug]
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

describe("GET /api/categories", () => {
  it("returns list of categories", async () => {
    const res = await fetch(`${BASE}/api/categories`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

describe("GET /api/categories/[slug]", () => {
  it("returns 404 for non-existent slug", async () => {
    const res = await fetch(`${BASE}/api/categories/nonexistent-category-xyz`);
    expect(res.status).toBe(404);
  });

  it("returns a category by slug (after creating one)", async () => {
    const slug = `e2e-cat-${Date.now()}`;

    // Create via POST
    const createRes = await fetch(`${BASE}/api/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "E2E Category", slug }),
    });
    expect(createRes.status).toBe(201);

    // Fetch by slug
    const getRes = await fetch(`${BASE}/api/categories/${slug}`);
    expect(getRes.status).toBe(200);

    const body = await getRes.json();
    expect(body.slug).toBe(slug);
    expect(body.name).toBe("E2E Category");

    // Cleanup
    await fetch(`${BASE}/api/categories/${slug}`, { method: "DELETE" });
  });
});
