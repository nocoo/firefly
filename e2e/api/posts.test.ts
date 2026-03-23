/**
 * L2 API E2E — Posts endpoints
 *
 * Covers: GET /api/posts, GET /api/posts/[slug], POST /api/posts,
 *         PUT /api/posts/[slug], DELETE /api/posts/[slug]
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17043";

describe("GET /api/posts", () => {
  it("returns paginated list of published posts", async () => {
    const res = await fetch(`${BASE}/api/posts`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("posts");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page");
    expect(Array.isArray(body.posts)).toBe(true);
  });

  it("supports page and page_size params", async () => {
    const res = await fetch(`${BASE}/api/posts?page=1&page_size=5`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.posts.length).toBeLessThanOrEqual(5);
  });

  it("supports search query param", async () => {
    const res = await fetch(`${BASE}/api/posts?q=nonexistent-query-xyz`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.posts).toEqual([]);
  });
});

describe("GET /api/posts/[slug]", () => {
  it("returns 404 for non-existent slug", async () => {
    const res = await fetch(`${BASE}/api/posts/this-slug-does-not-exist-xyz`);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/posts", () => {
  it("creates a new draft post", async () => {
    const slug = `e2e-test-post-${Date.now()}`;
    const res = await fetch(`${BASE}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "E2E Test Post",
        slug,
        content: "This is an E2E test post.",
        status: "draft",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.slug).toBe(slug);
    expect(body.status).toBe("draft");
    expect(body.id).toBeDefined();

    // Draft posts should NOT appear in public listing
    const listRes = await fetch(`${BASE}/api/posts`);
    const listBody = await listRes.json();
    const found = listBody.posts.find(
      (p: { slug: string }) => p.slug === slug,
    );
    expect(found).toBeUndefined();

    // Cleanup: delete the post
    await fetch(`${BASE}/api/posts/${slug}`, { method: "DELETE" });
  });

  it("rejects post without title", async () => {
    const res = await fetch(`${BASE}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "no-title", content: "test" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects post without slug", async () => {
    const res = await fetch(`${BASE}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "No Slug", content: "test" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/posts/[slug]", () => {
  it("updates an existing post", async () => {
    // Create
    const slug = `e2e-update-post-${Date.now()}`;
    const createRes = await fetch(`${BASE}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Original Title",
        slug,
        content: "Original content",
        status: "draft",
      }),
    });
    expect(createRes.status).toBe(201);

    // Update
    const updateRes = await fetch(`${BASE}/api/posts/${slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Title" }),
    });
    expect(updateRes.status).toBe(200);

    const body = await updateRes.json();
    expect(body.title).toBe("Updated Title");

    // Cleanup
    await fetch(`${BASE}/api/posts/${slug}`, { method: "DELETE" });
  });

  it("returns 404 for non-existent slug", async () => {
    const res = await fetch(`${BASE}/api/posts/nonexistent-slug-xyz`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Nope" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/posts/[slug]", () => {
  it("deletes an existing post", async () => {
    // Create
    const slug = `e2e-delete-post-${Date.now()}`;
    await fetch(`${BASE}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "To Delete",
        slug,
        content: "Will be deleted",
        status: "draft",
      }),
    });

    // Delete
    const deleteRes = await fetch(`${BASE}/api/posts/${slug}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(200);
    const body = await deleteRes.json();
    expect(body.deleted).toBe(true);

    // Verify gone
    const getRes = await fetch(`${BASE}/api/posts/${slug}`);
    expect(getRes.status).toBe(404);
  });

  it("returns 404 for non-existent slug", async () => {
    const res = await fetch(`${BASE}/api/posts/nonexistent-delete-xyz`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});
