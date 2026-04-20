/**
 * L2 API E2E — Analytics Source endpoint
 *
 * Covers: GET /api/analytics/source
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

// ---------------------------------------------------------------------------
// GET /api/analytics/source
// ---------------------------------------------------------------------------

describe("GET /api/analytics/source", () => {
  it("returns 400 when type is missing", async () => {
    const res = await fetch(`${BASE}/api/analytics/source`);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Invalid type");
  });

  it("returns 400 when type is invalid", async () => {
    const res = await fetch(`${BASE}/api/analytics/source?type=invalid`);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Invalid type");
  });

  it("returns human source detail", async () => {
    const res = await fetch(`${BASE}/api/analytics/source?type=human`);
    expect(res.status).toBe(200);

    const body = await res.json();
    // Structure depends on implementation, but should be an object
    expect(typeof body).toBe("object");
  });

  it("returns search source detail", async () => {
    const res = await fetch(`${BASE}/api/analytics/source?type=search`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  it("returns AI bot source detail", async () => {
    const res = await fetch(`${BASE}/api/analytics/source?type=ai`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  it("returns other bot source detail", async () => {
    const res = await fetch(`${BASE}/api/analytics/source?type=other`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  it("accepts days parameter", async () => {
    const res = await fetch(`${BASE}/api/analytics/source?type=human&days=7`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  it("clamps days to valid range", async () => {
    // Days too high should be clamped to MAX_DAYS (365)
    const res = await fetch(
      `${BASE}/api/analytics/source?type=human&days=9999`,
    );
    expect(res.status).toBe(200);
  });

  it("handles invalid days gracefully", async () => {
    // Non-numeric days should use default (30)
    const res = await fetch(
      `${BASE}/api/analytics/source?type=human&days=invalid`,
    );
    expect(res.status).toBe(200);
  });
});
