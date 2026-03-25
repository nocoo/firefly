/**
 * L2 API E2E — Analytics endpoint
 *
 * Covers: GET /api/analytics (summary endpoint)
 *
 * Note: Analytics pageview tracking happens in the proxy middleware (fire-and-forget),
 * not via a dedicated POST endpoint. Only GET is tested here.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17043";

describe("GET /api/analytics", () => {
  it("returns summary data with default 30-day range", async () => {
    const res = await fetch(`${BASE}/api/analytics`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("overview");
    expect(body).toHaveProperty("daily");
    expect(body).toHaveProperty("aggregates");
    expect(body).toHaveProperty("period");
    expect(body.period.days).toBe(30);
    expect(body.period).toHaveProperty("startDate");
    expect(body.period).toHaveProperty("endDate");

    // Overview should have four-source breakdown
    expect(body.overview).toHaveProperty("total");
    expect(body.overview).toHaveProperty("human");
    expect(body.overview).toHaveProperty("search");
    expect(body.overview).toHaveProperty("ai");
    expect(body.overview).toHaveProperty("otherBot");

    // Aggregates should have three sections
    expect(body.aggregates).toHaveProperty("countries");
    expect(body.aggregates).toHaveProperty("platforms");
    expect(body.aggregates).toHaveProperty("browsers");
  });

  it("respects days query param", async () => {
    const res = await fetch(`${BASE}/api/analytics?days=7`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.period.days).toBe(7);
  });

  it("clamps days to valid range (1-365)", async () => {
    const res = await fetch(`${BASE}/api/analytics?days=0`);
    expect(res.status).toBe(200);

    const body = await res.json();
    // days=0 should be clamped to 1 (minimum)
    expect(body.period.days).toBeGreaterThanOrEqual(1);
  });
});
