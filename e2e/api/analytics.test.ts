/**
 * L2 API E2E — Analytics endpoint
 *
 * Covers: GET /api/analytics
 *
 * Note: Analytics pageview tracking happens in the proxy middleware (fire-and-forget),
 * not via a dedicated POST endpoint. Only GET is tested here.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17043";

describe("GET /api/analytics", () => {
  it("returns analytics data with default 30-day range", async () => {
    const res = await fetch(`${BASE}/api/analytics`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("overview");
    expect(body).toHaveProperty("dailyStats");
    expect(body).toHaveProperty("topPosts");
    expect(body).toHaveProperty("recentViews");
    expect(body).toHaveProperty("topReferrers");
    expect(body).toHaveProperty("devices");
    expect(body).toHaveProperty("browsers");
    expect(body).toHaveProperty("bots");
    expect(body).toHaveProperty("period");
    expect(body.period.days).toBe(30);
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
