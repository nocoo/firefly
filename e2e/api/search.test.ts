/**
 * L3 API E2E — Search endpoint
 *
 * Covers: GET /api/search?q=...
 *
 * Note: These tests run against the real D1 database with FTS5 index.
 * The FTS index must be built (via fts-rebuild) for search to return results.
 * Tests are designed to verify correct response shape even when the index
 * may be empty or partially built.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17043";

describe("GET /api/search", () => {
  it("returns 400 when q param is missing", async () => {
    const res = await fetch(`${BASE}/api/search`);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when q param is empty", async () => {
    const res = await fetch(`${BASE}/api/search?q=`);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns correct shape for a valid query", async () => {
    const res = await fetch(`${BASE}/api/search?q=test`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("posts");
    expect(body).toHaveProperty("snippets");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("pageSize");
    expect(Array.isArray(body.posts)).toBe(true);
    expect(typeof body.snippets).toBe("object");
    expect(typeof body.total).toBe("number");
  });

  it("supports pagination params", async () => {
    const res = await fetch(`${BASE}/api/search?q=test&page=1&page_size=5`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.posts.length).toBeLessThanOrEqual(5);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(5);
  });

  it("returns empty results for nonexistent query", async () => {
    const res = await fetch(
      `${BASE}/api/search?q=zzz_nonexistent_query_xyz_12345`,
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.posts).toEqual([]);
    expect(body.total).toBe(0);
  });
});
