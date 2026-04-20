/**
 * L2 API E2E — Categories endpoints
 *
 * Covers: GET /api/categories, GET /api/categories/[slug],
 *         PUT /api/categories/reorder
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

// ---------------------------------------------------------------------------
// PUT /api/categories/reorder
// ---------------------------------------------------------------------------

describe("PUT /api/categories/reorder", () => {
  it("returns 400 when ids is empty", async () => {
    const res = await fetch(`${BASE}/api/categories/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [] }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when ids is not an array", async () => {
    const res = await fetch(`${BASE}/api/categories/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: "not-an-array" }),
    });

    expect(res.status).toBe(400);
  });

  it("reorders categories with valid ids", async () => {
    // First get existing categories
    const listRes = await fetch(`${BASE}/api/categories`);
    const categories = await listRes.json();

    if (categories.length < 2) {
      // Create two test categories for reordering
      const slug1 = `e2e-reorder-1-${Date.now()}`;
      const slug2 = `e2e-reorder-2-${Date.now()}`;

      await fetch(`${BASE}/api/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Reorder Test 1", slug: slug1 }),
      });
      await fetch(`${BASE}/api/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Reorder Test 2", slug: slug2 }),
      });

      // Re-fetch
      const newListRes = await fetch(`${BASE}/api/categories`);
      const newCategories = await newListRes.json();

      const ids = newCategories.map((c: { id: string }) => c.id);
      const res = await fetch(`${BASE}/api/categories/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      expect(res.status).toBe(200);

      // Cleanup
      await fetch(`${BASE}/api/categories/${slug1}`, { method: "DELETE" });
      await fetch(`${BASE}/api/categories/${slug2}`, { method: "DELETE" });
    } else {
      // Use existing categories
      const ids = categories.map((c: { id: string }) => c.id);
      const res = await fetch(`${BASE}/api/categories/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.ok).toBe(true);
    }
  });
});
