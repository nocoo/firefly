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

describe("GET /api/analytics/source", () => {
  it("returns human detail data", async () => {
    const res = await fetch(`${BASE}/api/analytics/source?type=human&days=7`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.type).toBe("human");
    expect(body).toHaveProperty("topPages");
    expect(body).toHaveProperty("topReferrers");
    expect(body).toHaveProperty("devices");
    expect(body).toHaveProperty("browsers");
    expect(body).toHaveProperty("os");
    expect(body).toHaveProperty("countries");
    expect(body).toHaveProperty("recent24h");
  });

  it("returns search detail data", async () => {
    const res = await fetch(`${BASE}/api/analytics/source?type=search&days=7`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.type).toBe("search");
    expect(body).toHaveProperty("bots");
    expect(body).toHaveProperty("topPages");
    expect(body).toHaveProperty("dailyByBot");
    expect(body).toHaveProperty("crawlerVsPage");
  });

  it("returns AI bot detail data", async () => {
    const res = await fetch(`${BASE}/api/analytics/source?type=ai&days=7`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.type).toBe("ai");
    expect(body).toHaveProperty("bots");
    expect(body).toHaveProperty("topPages");
    expect(body).toHaveProperty("dailyByBot");
  });

  it("returns other bot detail data", async () => {
    const res = await fetch(`${BASE}/api/analytics/source?type=other&days=7`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.type).toBe("other");
    expect(body).toHaveProperty("byCategory");
    expect(body).toHaveProperty("socialBots");
    expect(body).toHaveProperty("monitorBots");
    expect(body).toHaveProperty("unknownBots");
  });

  it("returns 400 for missing type param", async () => {
    const res = await fetch(`${BASE}/api/analytics/source`);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid type param", async () => {
    const res = await fetch(`${BASE}/api/analytics/source?type=invalid`);
    expect(res.status).toBe(400);
  });
});
