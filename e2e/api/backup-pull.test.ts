/**
 * L2 API E2E — Backup pull webhook + pull-key endpoints
 *
 * Covers: HEAD/POST /api/backup/pull, GET/POST/DELETE /api/backup/pull-key
 *
 * Note: Pull webhook uses its own X-Webhook-Key auth (NOT session auth),
 * so 401 tests work even with E2E_SKIP_AUTH=true.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17043";

// ---------------------------------------------------------------------------
// Pull key CRUD
// ---------------------------------------------------------------------------

describe("pull-key CRUD", () => {
  afterAll(async () => {
    // Clean up
    await fetch(`${BASE}/api/backup/pull-key`, { method: "DELETE" });
  });

  it("GET returns configured: false when no key exists", async () => {
    await fetch(`${BASE}/api/backup/pull-key`, { method: "DELETE" });

    const res = await fetch(`${BASE}/api/backup/pull-key`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.configured).toBe(false);
  });

  it("POST generates a new pull key", async () => {
    const res = await fetch(`${BASE}/api/backup/pull-key`, {
      method: "POST",
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.key).toBeDefined();
    expect(typeof body.key).toBe("string");
    expect(body.key.length).toBeGreaterThan(0);
  });

  it("GET returns configured: true after generation", async () => {
    const res = await fetch(`${BASE}/api/backup/pull-key`);
    const body = await res.json();
    expect(body.configured).toBe(true);
    expect(body.key).toBeDefined();
  });

  it("DELETE revokes the pull key", async () => {
    const res = await fetch(`${BASE}/api/backup/pull-key`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.revoked).toBe(true);

    // Verify it's gone
    const getRes = await fetch(`${BASE}/api/backup/pull-key`);
    const getBody = await getRes.json();
    expect(getBody.configured).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Pull webhook authentication
// ---------------------------------------------------------------------------

describe("pull webhook auth", () => {
  let pullKey: string;

  beforeAll(async () => {
    // Generate a pull key
    const res = await fetch(`${BASE}/api/backup/pull-key`, {
      method: "POST",
    });
    const body = await res.json();
    pullKey = body.key;
  });

  afterAll(async () => {
    await fetch(`${BASE}/api/backup/pull-key`, { method: "DELETE" });
  });

  it("HEAD returns 401 without X-Webhook-Key", async () => {
    const res = await fetch(`${BASE}/api/backup/pull`, {
      method: "HEAD",
    });
    expect(res.status).toBe(401);
  });

  it("HEAD returns 401 with invalid key", async () => {
    const res = await fetch(`${BASE}/api/backup/pull`, {
      method: "HEAD",
      headers: { "X-Webhook-Key": "invalid-key" },
    });
    expect(res.status).toBe(401);
  });

  it("HEAD returns 200 with valid key", async () => {
    const res = await fetch(`${BASE}/api/backup/pull`, {
      method: "HEAD",
      headers: { "X-Webhook-Key": pullKey },
    });
    expect(res.status).toBe(200);
  });

  it("POST returns 401 without X-Webhook-Key", async () => {
    const res = await fetch(`${BASE}/api/backup/pull`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("POST returns 422 when push config is not set", async () => {
    // Clear push config
    await fetch(`${BASE}/api/backup`, { method: "DELETE" });

    const res = await fetch(`${BASE}/api/backup/pull`, {
      method: "POST",
      headers: { "X-Webhook-Key": pullKey },
    });
    expect(res.status).toBe(422);
  });
});
