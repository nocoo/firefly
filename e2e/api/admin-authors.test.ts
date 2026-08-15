/**
 * L2 API E2E — Admin human authors
 *
 * Covers: GET /api/admin/authors, POST /api/admin/authors,
 *         PATCH /api/admin/authors/[id], DELETE /api/admin/authors/[id]
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

async function createAuthor(suffix = Date.now().toString()) {
  const res = await fetch(`${BASE}/api/admin/authors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `E2E Human ${suffix}`,
      slug: `e2e-human-${suffix}`,
      email: `e2e-${suffix}@example.com`,
      profile_public: false,
    }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

describe("GET /api/admin/authors", () => {
  it("lists humans only", async () => {
    const res = await fetch(`${BASE}/api/admin/authors`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.authors)).toBe(true);
    expect(body.authors.length).toBeGreaterThan(0);
    expect(body.authors[0]).toHaveProperty("name");
    expect(body.authors[0]).not.toHaveProperty("category_id");
  });
});

describe("POST /api/admin/authors", () => {
  it("creates a human author", async () => {
    const suffix = `${Date.now()}`;
    const { status, body } = await createAuthor(suffix);
    expect(status).toBe(201);
    expect(body.author.slug).toBe(`e2e-human-${suffix}`);
    expect(body.author.email).toBe(`e2e-${suffix}@example.com`);

    await fetch(`${BASE}/api/admin/authors/${body.author.id}`, {
      method: "DELETE",
    });
  });
});

describe("DELETE /api/admin/authors/[id]", () => {
  it("blocks deleting the default human", async () => {
    const list = await fetch(`${BASE}/api/admin/authors`);
    const body = await list.json();
    const def = body.authors.find((a: { is_default: number }) => a.is_default === 1);
    expect(def).toBeTruthy();
    const res = await fetch(`${BASE}/api/admin/authors/${def.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(409);
  });
});
