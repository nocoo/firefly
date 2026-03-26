/**
 * L2 API E2E — Backup endpoints
 *
 * Covers: GET/PUT/DELETE /api/backup, POST /api/backup/test,
 *         POST /api/backup/push, GET /api/backup/history
 *
 * Note: All /api/backup/* endpoints are proxy-protected (all methods),
 * but E2E_SKIP_AUTH=true bypasses auth in the test environment.
 * Auth guard correctness is verified by L1 proxy.test.ts.
 *
 * Push and history tests without a real Backy server can only verify
 * the "not configured" path — actual push tests need a running Backy.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17043";

describe("GET /api/backup (unconfigured)", () => {
  it("returns configured: false when no config set", async () => {
    // Ensure clean state by deleting any existing config
    await fetch(`${BASE}/api/backup`, { method: "DELETE" });

    const res = await fetch(`${BASE}/api/backup`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.configured).toBe(false);
  });
});

describe("PUT /api/backup", () => {
  afterAll(async () => {
    // Clean up: clear config after tests
    await fetch(`${BASE}/api/backup`, { method: "DELETE" });
  });

  it("saves valid config", async () => {
    const res = await fetch(`${BASE}/api/backup`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhookUrl: "https://backy.dev.hexly.ai/api/webhook/test-project",
        apiKey: "test-api-key-1234567890abcdef",
      }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.saved).toBe(true);
  });

  it("rejects missing webhookUrl", async () => {
    const res = await fetch(`${BASE}/api/backup`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "key" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid webhookUrl", async () => {
    const res = await fetch(`${BASE}/api/backup`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhookUrl: "not-a-url",
        apiKey: "key",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects missing apiKey on initial setup (no existing config)", async () => {
    // Ensure clean state — no existing config
    await fetch(`${BASE}/api/backup`, { method: "DELETE" });

    const res = await fetch(`${BASE}/api/backup`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhookUrl: "https://example.com/webhook",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("allows omitting apiKey when updating existing config", async () => {
    // Set up initial config
    await fetch(`${BASE}/api/backup`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhookUrl: "https://backy.dev.hexly.ai/api/webhook/test-project",
        apiKey: "test-api-key-1234567890abcdef",
      }),
    });

    // Update only the URL, omit apiKey
    const res = await fetch(`${BASE}/api/backup`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhookUrl: "https://backy.dev.hexly.ai/api/webhook/updated-project",
      }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.saved).toBe(true);

    // Verify URL was updated and key was preserved
    const getRes = await fetch(`${BASE}/api/backup`);
    const getBody = await getRes.json();
    expect(getBody.configured).toBe(true);
    expect(getBody.webhookUrl).toBe(
      "https://backy.dev.hexly.ai/api/webhook/updated-project",
    );
    // Key should still be masked (preserved from before)
    expect(getBody.apiKey).toContain("\u2022");
  });

  it("rejects invalid JSON body", async () => {
    const res = await fetch(`${BASE}/api/backup`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/backup (configured)", () => {
  beforeAll(async () => {
    // Set up config
    await fetch(`${BASE}/api/backup`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhookUrl: "https://backy.dev.hexly.ai/api/webhook/test-project",
        apiKey: "test-api-key-1234567890abcdef",
      }),
    });
  });

  afterAll(async () => {
    await fetch(`${BASE}/api/backup`, { method: "DELETE" });
  });

  it("returns configured: true with masked key", async () => {
    const res = await fetch(`${BASE}/api/backup`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.configured).toBe(true);
    expect(body.webhookUrl).toBe(
      "https://backy.dev.hexly.ai/api/webhook/test-project",
    );
    // API key should be masked (not the raw key)
    expect(body.apiKey).not.toBe("test-api-key-1234567890abcdef");
    expect(body.apiKey).toContain("\u2022"); // bullet character from masking
  });
});

describe("DELETE /api/backup", () => {
  it("clears config and returns cleared: true", async () => {
    // Set up config first
    await fetch(`${BASE}/api/backup`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhookUrl: "https://example.com/webhook",
        apiKey: "key-to-delete-12345678",
      }),
    });

    const res = await fetch(`${BASE}/api/backup`, { method: "DELETE" });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.cleared).toBe(true);

    // Verify it's actually cleared
    const getRes = await fetch(`${BASE}/api/backup`);
    const getBody = await getRes.json();
    expect(getBody.configured).toBe(false);
  });
});

describe("POST /api/backup/test (no config)", () => {
  beforeAll(async () => {
    // Ensure no config exists
    await fetch(`${BASE}/api/backup`, { method: "DELETE" });
  });

  it("returns 422 when backup is not configured", async () => {
    const res = await fetch(`${BASE}/api/backup/test`, {
      method: "POST",
    });
    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// Push endpoint
// ---------------------------------------------------------------------------

describe("POST /api/backup/push (no config)", () => {
  beforeAll(async () => {
    await fetch(`${BASE}/api/backup`, { method: "DELETE" });
  });

  it("returns 422 when backup is not configured", async () => {
    const res = await fetch(`${BASE}/api/backup/push`, {
      method: "POST",
    });
    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// History endpoint
// ---------------------------------------------------------------------------

describe("GET /api/backup/history (no config)", () => {
  beforeAll(async () => {
    await fetch(`${BASE}/api/backup`, { method: "DELETE" });
  });

  it("returns 422 when backup is not configured", async () => {
    const res = await fetch(`${BASE}/api/backup/history`);
    expect(res.status).toBe(422);
  });
});
