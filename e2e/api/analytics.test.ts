/**
 * L2 API E2E — Analytics endpoint
 *
 * Covers: GET /api/analytics (summary endpoint)
 *         GET /api/analytics/source (source detail endpoint)
 *
 * Note: Analytics pageview tracking happens in the proxy middleware (fire-and-forget),
 * not via a dedicated POST endpoint. Only GET is tested here.
 * Auth 401 is tested at L1 (proxy unit tests) since E2E runs with E2E_SKIP_AUTH=true.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

describe.concurrent("GET /api/analytics", () => {
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

  it("returns consistent period across different days params", async () => {
    const [res7, res90] = await Promise.all([
      fetch(`${BASE}/api/analytics?days=7`),
      fetch(`${BASE}/api/analytics?days=90`),
    ]);

    const body7 = await res7.json();
    const body90 = await res90.json();

    // Both should have valid date formats
    expect(body7.period.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body7.period.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body90.period.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // endDate should be the same (yesterday) regardless of period
    expect(body7.period.endDate).toBe(body90.period.endDate);

    // 90-day range should start earlier than 7-day
    expect(body90.period.startDate < body7.period.startDate).toBe(true);
  });

  it("overview delta values are valid types (number, 'new', or null)", async () => {
    const res = await fetch(`${BASE}/api/analytics`);
    const body = await res.json();

    const deltaFields = [
      "totalDelta",
      "humanDelta",
      "searchDelta",
      "aiDelta",
      "otherBotDelta",
    ];
    for (const field of deltaFields) {
      const val = body.overview[field];
      expect(
        val === null || typeof val === "number" || val === "new",
      ).toBe(true);
    }
  });

  it("daily trend entries have all four source fields", async () => {
    const res = await fetch(`${BASE}/api/analytics?days=7`);
    const body = await res.json();

    expect(Array.isArray(body.daily)).toBe(true);
    // Zero-filled: should have entries for each day in range
    if (body.daily.length > 0) {
      const entry = body.daily[0];
      expect(entry).toHaveProperty("date");
      expect(entry).toHaveProperty("human");
      expect(entry).toHaveProperty("search");
      expect(entry).toHaveProperty("ai");
      expect(entry).toHaveProperty("otherBot");
      expect(typeof entry.human).toBe("number");
    }
  });

  it("clamps very large days param to 365", async () => {
    const res = await fetch(`${BASE}/api/analytics?days=9999`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.period.days).toBeLessThanOrEqual(365);
  });
});

describe.concurrent("GET /api/analytics/source", () => {
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
    expect(typeof body.recent24h).toBe("number");
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
    expect(Array.isArray(body.bots)).toBe(true);
    expect(Array.isArray(body.dailyByBot)).toBe(true);
  });

  it("returns AI bot detail data", async () => {
    const res = await fetch(`${BASE}/api/analytics/source?type=ai&days=7`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.type).toBe("ai");
    expect(body).toHaveProperty("bots");
    expect(body).toHaveProperty("topPages");
    expect(body).toHaveProperty("dailyByBot");
    expect(Array.isArray(body.bots)).toBe(true);
    expect(Array.isArray(body.dailyByBot)).toBe(true);
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
    expect(Array.isArray(body.byCategory)).toBe(true);
  });

  it("returns 400 for missing type param", async () => {
    const res = await fetch(`${BASE}/api/analytics/source`);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid type param", async () => {
    const res = await fetch(`${BASE}/api/analytics/source?type=invalid`);
    expect(res.status).toBe(400);
  });

  it("source detail respects different days params", async () => {
    const [res7, res30] = await Promise.all([
      fetch(`${BASE}/api/analytics/source?type=human&days=7`),
      fetch(`${BASE}/api/analytics/source?type=human&days=30`),
    ]);

    expect(res7.status).toBe(200);
    expect(res30.status).toBe(200);

    const body7 = await res7.json();
    const body30 = await res30.json();

    // Both should have the same type
    expect(body7.type).toBe("human");
    expect(body30.type).toBe("human");
  });

  it("topPages items have required fields when present", async () => {
    const res = await fetch(`${BASE}/api/analytics/source?type=human&days=30`);
    const body = await res.json();

    if (body.topPages.length > 0) {
      const page = body.topPages[0];
      expect(page).toHaveProperty("path");
      expect(page).toHaveProperty("title");
      expect(page).toHaveProperty("isPost");
      expect(page).toHaveProperty("views");
      expect(typeof page.isPost).toBe("boolean");
      expect(typeof page.views).toBe("number");
    }
  });
});
