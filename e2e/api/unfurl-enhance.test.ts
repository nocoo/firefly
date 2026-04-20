/**
 * L2 API E2E — Unfurl enhance and Favicon endpoints
 *
 * Covers: POST /api/unfurl/enhance, GET /api/favicon
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

// ---------------------------------------------------------------------------
// POST /api/unfurl/enhance
// ---------------------------------------------------------------------------

describe("POST /api/unfurl/enhance", () => {
  it("returns 400 when neither title nor description provided", async () => {
    const res = await fetch(`${BASE}/api/unfurl/enhance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when only bodyText provided", async () => {
    const res = await fetch(`${BASE}/api/unfurl/enhance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bodyText: "Some body text" }),
    });

    expect(res.status).toBe(400);
  });

  // Note: Successful enhancement requires AI to be configured.
  // The 502 path is tested when AI is not configured.
  it("returns 502 when AI is not configured", async () => {
    // Clear AI settings first
    await fetch(`${BASE}/api/settings/ai`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "", apiKey: "" }),
    });

    const res = await fetch(`${BASE}/api/unfurl/enhance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test Title",
        description: "Test description for enhancement",
      }),
    });

    expect(res.status).toBe(502);
  });
});

// ---------------------------------------------------------------------------
// GET /api/favicon
// ---------------------------------------------------------------------------

describe("GET /api/favicon", () => {
  it("redirects to favicon (302)", async () => {
    const res = await fetch(`${BASE}/api/favicon`, {
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBeTruthy();
  });

  it("accepts size parameter", async () => {
    const res = await fetch(`${BASE}/api/favicon?size=48`, {
      redirect: "manual",
    });

    expect(res.status).toBe(302);
  });

  it("uses default size for invalid size parameter", async () => {
    const res = await fetch(`${BASE}/api/favicon?size=999`, {
      redirect: "manual",
    });

    expect(res.status).toBe(302);
  });
});
