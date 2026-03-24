/**
 * L2 API E2E — Post excerpt generation endpoint
 *
 * Covers: POST /api/posts/[slug]/excerpt
 *
 * Since E2E environment has no AI provider configured by default,
 * we test the error paths (400 AI not configured, 404 not found).
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17043";

describe("POST /api/posts/[slug]/excerpt", () => {
  it("returns 400 when AI is not configured", async () => {
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
      // Try to generate excerpt — should fail because AI is not configured
      const res = await fetch(`${BASE}/api/posts/${slug}/excerpt`, {
        method: "POST",
      });
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toMatch(/AI provider not configured/i);
    } finally {
      // Cleanup regardless of test result
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
