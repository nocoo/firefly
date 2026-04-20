/**
 * L2 API E2E — Settings AI endpoints
 *
 * Covers: GET /api/settings/ai, PUT /api/settings/ai,
 *         POST /api/settings/ai/test
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

// ---------------------------------------------------------------------------
// GET /api/settings/ai
// ---------------------------------------------------------------------------

describe("GET /api/settings/ai", () => {
  it("returns AI settings with masked API key", async () => {
    const res = await fetch(`${BASE}/api/settings/ai`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("provider");
    expect(body).toHaveProperty("hasApiKey");
    // API key should be masked or empty
    if (body.apiKey) {
      expect(body.apiKey).toMatch(/^\*+|^$/);
    }
  });
});

// ---------------------------------------------------------------------------
// PUT /api/settings/ai
// ---------------------------------------------------------------------------

describe("PUT /api/settings/ai", () => {
  it("updates model setting", async () => {
    const res = await fetch(`${BASE}/api/settings/ai`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
      }),
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.model).toBe("gpt-4o-mini");
  });

  it("returns 400 for invalid provider", async () => {
    const res = await fetch(`${BASE}/api/settings/ai`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "invalid-provider-xyz",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid sdkType", async () => {
    const res = await fetch(`${BASE}/api/settings/ai`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sdkType: "invalid-sdk",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("accepts valid provider and sdkType", async () => {
    const res = await fetch(`${BASE}/api/settings/ai`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "openai",
        sdkType: "openai",
      }),
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.provider).toBe("openai");
    expect(body.sdkType).toBe("openai");
  });

  it("clears provider when empty string", async () => {
    const res = await fetch(`${BASE}/api/settings/ai`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "",
      }),
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.provider).toBe("");
  });
});

// ---------------------------------------------------------------------------
// POST /api/settings/ai/test
// ---------------------------------------------------------------------------

describe("POST /api/settings/ai/test", () => {
  it("returns 400 when AI is not configured", async () => {
    // First clear the settings
    await fetch(`${BASE}/api/settings/ai`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "", apiKey: "" }),
    });

    const res = await fetch(`${BASE}/api/settings/ai/test`, {
      method: "POST",
    });

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("configured");
  });
});
