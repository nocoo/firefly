/**
 * L2 API E2E — MD Export endpoints
 *
 * Covers: GET /api/md, GET /api/md/[year]/[month]/[slug]
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

// ---------------------------------------------------------------------------
// GET /api/md
// ---------------------------------------------------------------------------

describe.concurrent("GET /api/md", () => {
  it("returns markdown content with correct headers", async () => {
    const res = await fetch(`${BASE}/api/md`);
    expect(res.status).toBe(200);

    const contentType = res.headers.get("content-type");
    expect(contentType).toContain("text/markdown");

    const tokenHeader = res.headers.get("x-markdown-tokens");
    expect(tokenHeader).toBeTruthy();
    expect(Number(tokenHeader)).toBeGreaterThan(0);

    const body = await res.text();
    // Should start with a title heading
    expect(body).toMatch(/^#\s/);
    // Should contain sections
    expect(body).toContain("## Categories");
    expect(body).toContain("## Recent Posts");
    expect(body).toContain("## Feeds");
  });
});

// ---------------------------------------------------------------------------
// GET /api/md/[year]/[month]/[slug]
// ---------------------------------------------------------------------------

describe.concurrent("GET /api/md/[year]/[month]/[slug]", () => {
  let testPostSlug: string;
  let testYear: string;
  let testMonth: string;

  beforeAll(async () => {
    // Create a published test post
    const now = new Date();
    testYear = String(now.getFullYear());
    testMonth = String(now.getMonth() + 1).padStart(2, "0");
    testPostSlug = `e2e-md-export-${Date.now()}`;

    await fetch(`${BASE}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "E2E MD Export Test",
        slug: testPostSlug,
        content: "This is the content for MD export test.",
        excerpt: "Test excerpt",
        status: "published",
      }),
    });
  });

  afterAll(async () => {
    await fetch(`${BASE}/api/posts/${testPostSlug}`, { method: "DELETE" });
  });

  it("returns markdown for a valid post", async () => {
    const res = await fetch(
      `${BASE}/api/md/${testYear}/${testMonth}/${testPostSlug}`,
    );
    expect(res.status).toBe(200);

    const contentType = res.headers.get("content-type");
    expect(contentType).toContain("text/markdown");

    const tokenHeader = res.headers.get("x-markdown-tokens");
    expect(tokenHeader).toBeTruthy();

    const body = await res.text();
    // Should contain the title
    expect(body).toContain("# E2E MD Export Test");
    // Should contain the excerpt as blockquote
    expect(body).toContain("> Test excerpt");
    // Should contain the content
    expect(body).toContain("This is the content for MD export test");
  });

  it("returns 404 for non-existent post", async () => {
    const res = await fetch(
      `${BASE}/api/md/${testYear}/${testMonth}/nonexistent-post-xyz`,
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for mismatched year", async () => {
    const wrongYear = String(Number(testYear) - 1);
    const res = await fetch(
      `${BASE}/api/md/${wrongYear}/${testMonth}/${testPostSlug}`,
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for mismatched month", async () => {
    // Use a wrong month
    const wrongMonth = testMonth === "01" ? "12" : "01";
    const res = await fetch(
      `${BASE}/api/md/${testYear}/${wrongMonth}/${testPostSlug}`,
    );
    expect(res.status).toBe(404);
  });
});
