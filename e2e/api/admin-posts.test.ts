/**
 * L2 API E2E — Admin Posts and Search endpoints
 *
 * Covers: GET /api/admin/posts, PATCH /api/admin/posts/batch,
 *         GET /api/admin/search
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

// ---------------------------------------------------------------------------
// GET /api/admin/posts
// ---------------------------------------------------------------------------

describe("GET /api/admin/posts", () => {
  it("returns list of all posts (including drafts)", async () => {
    const res = await fetch(`${BASE}/api/admin/posts`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("posts");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.posts)).toBe(true);
  });

  it("supports status filter", async () => {
    const res = await fetch(`${BASE}/api/admin/posts?status=draft`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("posts");
    // All returned posts should be drafts (if any)
    for (const post of body.posts) {
      expect(post.status).toBe("draft");
    }
  });

  it("supports pagination", async () => {
    const res = await fetch(`${BASE}/api/admin/posts?page=1&pageSize=5`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.posts.length).toBeLessThanOrEqual(5);
  });

  it("supports sort_by and sort_order", async () => {
    const res = await fetch(
      `${BASE}/api/admin/posts?sort_by=created_at&sort_order=desc`,
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("posts");
  });

  it("supports year and month filters", async () => {
    const year = new Date().getFullYear();
    const res = await fetch(`${BASE}/api/admin/posts?year=${year}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("posts");
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/posts/batch
// ---------------------------------------------------------------------------

describe("PATCH /api/admin/posts/batch", () => {
  it("returns 400 when ids is empty", async () => {
    const res = await fetch(`${BASE}/api/admin/posts/batch`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [],
        updates: { status: "archived" },
      }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when ids is not an array", async () => {
    const res = await fetch(`${BASE}/api/admin/posts/batch`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: "not-an-array",
        updates: { status: "archived" },
      }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when updates is missing", async () => {
    const res = await fetch(`${BASE}/api/admin/posts/batch`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: ["some-id"],
      }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid status", async () => {
    const res = await fetch(`${BASE}/api/admin/posts/batch`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: ["some-id"],
        updates: { status: "invalid-status" },
      }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when updates has no valid fields", async () => {
    const res = await fetch(`${BASE}/api/admin/posts/batch`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: ["some-id"],
        updates: { unknownField: "value" },
      }),
    });

    expect(res.status).toBe(400);
  });

  it("updates posts with valid status", async () => {
    // Use non-existent IDs - should return 0 changed but not error
    const res = await fetch(`${BASE}/api/admin/posts/batch`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: ["nonexistent-id-1", "nonexistent-id-2"],
        updates: { status: "archived" },
      }),
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("changed");
    expect(body.changed).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/search
// ---------------------------------------------------------------------------

describe("GET /api/admin/search", () => {
  it("returns empty results for empty query", async () => {
    const res = await fetch(`${BASE}/api/admin/search?q=`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.posts).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("returns search results for valid query", async () => {
    const res = await fetch(`${BASE}/api/admin/search?q=test`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("posts");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.posts)).toBe(true);
  });

  it("returns results for query with no matches", async () => {
    const res = await fetch(
      `${BASE}/api/admin/search?q=xyznonexistentquery123`,
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.posts).toEqual([]);
  });
});
