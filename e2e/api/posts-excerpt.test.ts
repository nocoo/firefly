/**
 * L2 API E2E — Post excerpt generation endpoint
 *
 * Covers: POST /api/posts/[slug]/excerpt
 *
 * The AI provider may or may not be configured in the E2E environment.
 * - If configured: 200 with { excerpt }
 * - If not configured: 400 with "AI provider not configured"
 * Both are valid outcomes; the test asserts correct response shapes.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

describe.concurrent("POST /api/posts/[slug]/excerpt", () => {
  it("returns 200 with excerpt or 400 when AI is not configured", async () => {
    const slug = `excerpt-test-${Date.now()}`;

    // Create a test post
    const createRes = await fetch(`${BASE}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Excerpt Test Post",
        slug,
        content: "Some content for testing AI excerpt generation.",
        status: "draft",
      }),
    });
    expect(createRes.status).toBe(201);

    try {
      const res = await fetch(`${BASE}/api/posts/${slug}/excerpt`, {
        method: "POST",
      });
      const body = await res.json();

      if (res.status === 200) {
        // AI configured — should return generated excerpt
        expect(body).toHaveProperty("excerpt");
        expect(typeof body.excerpt).toBe("string");
        expect(body.excerpt.length).toBeGreaterThan(0);
      } else {
        // AI not configured — should return 400
        expect(res.status).toBe(400);
        expect(body.error).toMatch(/AI provider not configured/i);
      }
    } finally {
      await fetch(`${BASE}/api/posts/${slug}`, { method: "DELETE" });
    }
  });

  it("returns 404 for non-existent slug", async () => {
    const res = await fetch(
      `${BASE}/api/posts/non-existent-slug-xyz-${Date.now()}/excerpt`,
      { method: "POST" },
    );
    expect(res.status).toBe(404);
  });
});
