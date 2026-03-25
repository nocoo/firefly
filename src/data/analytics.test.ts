import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import {
  recordPageView,
  getSiteDailyStats,
  getOverviewStats,
  getTopPosts,
  getRecentViewCount,
  getTopReferrers,
  getDeviceBreakdown,
  getBrowserBreakdown,
  getBotBreakdown,
  fillDailyGaps,
  fillDailyByBotGaps,
  formatPathAsTitle,
  computePeriodDates,
  getAnalyticsOverview,
  getAnalyticsDailyTrend,
  getAnalyticsAggregates,
  getHumanDetail,
  getSearchDetail,
  getAiBotDetail,
  getOtherBotDetail,
} from "./analytics";

function createMockDb(): Db {
  return {
    query: vi.fn(),
    firstOrNull: vi.fn(),
    execute: vi.fn(),
    batch: vi.fn(),
  };
}

describe("recordPageView", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("inserts a page view with all fields", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    await recordPageView(db, {
      path: "/test",
      postId: "p1",
      referrer: "https://google.com",
      userAgent: "Mozilla/5.0",
      ipHash: "abc123",
      country: "US",
      city: "NYC",
      deviceType: "desktop",
      browser: "Chrome",
      os: "macOS",
      isBot: false,
      botName: null,
      botCategory: null,
      sessionId: "sess1",
    });

    // INSERT page_view + UPDATE posts.view_count (human + postId)
    expect(db.execute).toHaveBeenCalledTimes(2);
    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("INSERT INTO page_views");
    expect(params).toHaveLength(15);
    expect(params![1]).toBe("p1"); // post_id
    expect(params![2]).toBe("/test"); // path
    expect(params![11]).toBe(0); // is_bot = false → 0

    // view_count increment
    const [updateSql, updateParams] = vi.mocked(db.execute).mock.calls[1];
    expect(updateSql).toContain("UPDATE posts SET view_count");
    expect(updateParams).toEqual(["p1"]);
  });

  it("records bot views with is_bot = 1", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    await recordPageView(db, {
      path: "/test",
      isBot: true,
      botName: "Googlebot",
      botCategory: "search",
    });

    // Only INSERT, no view_count update for bots
    expect(db.execute).toHaveBeenCalledOnce();
    const [, params] = vi.mocked(db.execute).mock.calls[0];
    expect(params![11]).toBe(1); // is_bot = true → 1
    expect(params![12]).toBe("Googlebot");
    expect(params![13]).toBe("search");
  });

  it("defaults optional fields to null", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    await recordPageView(db, { path: "/minimal" });

    // Only INSERT, no view_count update (no postId)
    expect(db.execute).toHaveBeenCalledOnce();
    const [, params] = vi.mocked(db.execute).mock.calls[0];
    expect(params![1]).toBeNull(); // post_id
    expect(params![3]).toBeNull(); // referrer
  });

  it("does not increment view_count for bot with postId", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    await recordPageView(db, {
      path: "/test",
      postId: "p1",
      isBot: true,
      botName: "GPTBot",
      botCategory: "ai",
    });

    // Only INSERT, no view_count update for bots even with postId
    expect(db.execute).toHaveBeenCalledOnce();
  });

  it("does not throw when view_count update fails", async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce({ changes: 1, duration: 1 }) // INSERT succeeds
      .mockRejectedValueOnce(new Error("UPDATE failed")); // UPDATE fails

    // Should not throw
    await expect(
      recordPageView(db, {
        path: "/test",
        postId: "p1",
        isBot: false,
      }),
    ).resolves.toBeUndefined();
  });
});

describe("getSiteDailyStats", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("queries site daily stats for the given period", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    await getSiteDailyStats(db, 7);

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("site_daily_stats");
    expect(params).toEqual([7]);
  });
});

describe("getOverviewStats", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns aggregated stats", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({
      total_views: 1000,
      unique_visitors: 500,
      bot_views: 200,
      ai_bot_views: 50,
      search_bot_views: 150,
    });

    const stats = await getOverviewStats(db, 30);

    expect(stats.totalViews).toBe(1000);
    expect(stats.totalUniqueVisitors).toBe(500);
    expect(stats.totalBotViews).toBe(200);
    expect(stats.totalAiBotViews).toBe(50);
  });

  it("returns zeros when no data", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    const stats = await getOverviewStats(db);

    expect(stats.totalViews).toBe(0);
    expect(stats.totalUniqueVisitors).toBe(0);
  });
});

describe("getTopPosts", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("queries top posts by views", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [
        { post_id: "p1", title: "Post 1", slug: "post-1", views: 100 },
      ],
      meta: { changes: 0, duration: 1 },
    });

    const posts = await getTopPosts(db, 30, 5);

    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe("Post 1");
    expect(posts[0].views).toBe(100);
  });
});

describe("getRecentViewCount", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("counts non-bot views in the given window", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 42 });

    const count = await getRecentViewCount(db, 24);

    expect(count).toBe(42);
    const [sql] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("is_bot = 0");
  });

  it("returns 0 when no views", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    const count = await getRecentViewCount(db);

    expect(count).toBe(0);
  });
});

describe("getTopReferrers", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns top referrers sorted by views", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [
        { referrer: "https://google.com", views: 50 },
        { referrer: "https://twitter.com", views: 20 },
      ],
      meta: { changes: 0, duration: 1 },
    });

    const referrers = await getTopReferrers(db, 30, 10);

    expect(referrers).toHaveLength(2);
    expect(referrers[0].referrer).toBe("https://google.com");
    expect(referrers[0].views).toBe(50);
    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("is_bot = 0");
  });
});

describe("getDeviceBreakdown", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns device type distribution", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [
        { device_type: "desktop", count: 100 },
        { device_type: "mobile", count: 50 },
      ],
      meta: { changes: 0, duration: 1 },
    });

    const devices = await getDeviceBreakdown(db, 30);

    expect(devices).toHaveLength(2);
    expect(devices[0].deviceType).toBe("desktop");
    expect(devices[0].count).toBe(100);
  });
});

describe("getBrowserBreakdown", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns browser distribution", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [
        { browser: "Chrome", count: 80 },
        { browser: "Safari", count: 30 },
      ],
      meta: { changes: 0, duration: 1 },
    });

    const browsers = await getBrowserBreakdown(db, 30, 10);

    expect(browsers).toHaveLength(2);
    expect(browsers[0].browser).toBe("Chrome");
  });
});

describe("getBotBreakdown", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns bot breakdown with category", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [
        { bot_name: "Googlebot", bot_category: "search", count: 100 },
        { bot_name: "GPTBot", bot_category: "ai", count: 50 },
      ],
      meta: { changes: 0, duration: 1 },
    });

    const bots = await getBotBreakdown(db, 30, 20);

    expect(bots).toHaveLength(2);
    expect(bots[0].botName).toBe("Googlebot");
    expect(bots[0].botCategory).toBe("search");
    expect(bots[1].botName).toBe("GPTBot");
    expect(bots[1].botCategory).toBe("ai");
    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("is_bot = 1");
  });
});

// ===========================================================================
// Four-source analytics: utility functions
// ===========================================================================

describe("fillDailyGaps", () => {
  it("returns empty array for invalid date range", () => {
    const result = fillDailyGaps([], "2026-03-25", "2026-03-20");
    expect(result).toEqual([]);
  });

  it("fills a complete range with zeros when no data", () => {
    const result = fillDailyGaps([], "2026-03-20", "2026-03-22");
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      date: "2026-03-20",
      human: 0,
      search: 0,
      ai: 0,
      otherBot: 0,
    });
    expect(result[2].date).toBe("2026-03-22");
  });

  it("preserves existing rows and fills gaps", () => {
    const rows = [
      { date: "2026-03-20", human: 10, search: 2, ai: 1, otherBot: 0 },
      { date: "2026-03-22", human: 5, search: 1, ai: 0, otherBot: 3 },
    ];
    const result = fillDailyGaps(rows, "2026-03-20", "2026-03-22");
    expect(result).toHaveLength(3);
    expect(result[0].human).toBe(10);
    expect(result[1]).toEqual({
      date: "2026-03-21",
      human: 0,
      search: 0,
      ai: 0,
      otherBot: 0,
    });
    expect(result[2].human).toBe(5);
  });

  it("handles single-day range", () => {
    const result = fillDailyGaps([], "2026-03-20", "2026-03-20");
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-03-20");
  });
});

describe("fillDailyByBotGaps", () => {
  it("returns empty array when no bots", () => {
    const result = fillDailyByBotGaps([], "2026-03-20", "2026-03-22");
    expect(result).toEqual([]);
  });

  it("generates cartesian product of bots × dates", () => {
    const rows = [
      { date: "2026-03-20", botName: "Googlebot", count: 10 },
      { date: "2026-03-21", botName: "Bingbot", count: 5 },
    ];
    const result = fillDailyByBotGaps(rows, "2026-03-20", "2026-03-21");
    // 2 bots × 2 days = 4 rows
    expect(result).toHaveLength(4);
    // Googlebot on 2026-03-20 = 10, on 2026-03-21 = 0
    expect(result.find((r) => r.date === "2026-03-20" && r.botName === "Googlebot")?.count).toBe(10);
    expect(result.find((r) => r.date === "2026-03-21" && r.botName === "Googlebot")?.count).toBe(0);
    // Bingbot on 2026-03-20 = 0, on 2026-03-21 = 5
    expect(result.find((r) => r.date === "2026-03-20" && r.botName === "Bingbot")?.count).toBe(0);
    expect(result.find((r) => r.date === "2026-03-21" && r.botName === "Bingbot")?.count).toBe(5);
  });

  it("fills single bot across all dates", () => {
    const rows = [{ date: "2026-03-21", botName: "GPTBot", count: 3 }];
    const result = fillDailyByBotGaps(rows, "2026-03-20", "2026-03-22");
    expect(result).toHaveLength(3); // 1 bot × 3 days
    expect(result[0]).toEqual({ date: "2026-03-20", botName: "GPTBot", count: 0 });
    expect(result[1]).toEqual({ date: "2026-03-21", botName: "GPTBot", count: 3 });
    expect(result[2]).toEqual({ date: "2026-03-22", botName: "GPTBot", count: 0 });
  });
});

describe("formatPathAsTitle", () => {
  it("returns Homepage for /", () => {
    expect(formatPathAsTitle("/")).toBe("Homepage");
  });

  it("formats article path", () => {
    expect(formatPathAsTitle("/2026/03/hello-world")).toBe("2026 / 03 / hello-world");
  });

  it("formats category path", () => {
    expect(formatPathAsTitle("/category/tech")).toBe("category / tech");
  });

  it("formats tag path", () => {
    expect(formatPathAsTitle("/tag/ai")).toBe("tag / ai");
  });

  it("strips trailing slash", () => {
    expect(formatPathAsTitle("/category/tech/")).toBe("category / tech");
  });
});

describe("computePeriodDates", () => {
  it("returns startDate and endDate strings", () => {
    const { startDate, endDate } = computePeriodDates(30);
    // Both should be YYYY-MM-DD format
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // endDate should be yesterday
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    expect(endDate).toBe(yesterday.toISOString().slice(0, 10));
  });

  it("has correct span between start and end", () => {
    const { startDate, endDate } = computePeriodDates(7);
    const start = new Date(startDate + "T00:00:00Z");
    const end = new Date(endDate + "T00:00:00Z");
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(6); // 7-day range = 6 day difference (inclusive)
  });
});

// ===========================================================================
// Four-source analytics: query functions
// ===========================================================================

describe("getAnalyticsOverview", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns overview with delta calculations", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce({
        total: 100,
        human: 70,
        search: 20,
        ai: 5,
        other_bot: 5,
      })
      .mockResolvedValueOnce({
        total: 50,
        human: 35,
        search: 10,
        ai: 3,
        other_bot: 2,
      });

    const result = await getAnalyticsOverview(db, 30);

    expect(result.total).toBe(100);
    expect(result.human).toBe(70);
    expect(result.totalDelta).toBe(100); // (100-50)/50 = 100%
    expect(result.humanDelta).toBe(100); // (70-35)/35 = 100%
  });

  it("returns null delta when previous period is zero", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce({ total: 10, human: 10, search: 0, ai: 0, other_bot: 0 })
      .mockResolvedValueOnce({ total: 0, human: 0, search: 0, ai: 0, other_bot: 0 });

    const result = await getAnalyticsOverview(db, 7);

    expect(result.totalDelta).toBeNull();
    expect(result.humanDelta).toBeNull();
  });

  it("returns all zeros when no data", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    const result = await getAnalyticsOverview(db, 30);

    expect(result.total).toBe(0);
    expect(result.human).toBe(0);
    expect(result.totalDelta).toBeNull();
  });

  it("uses strict is_bot=1 for search and ai partitioning in SQL", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({
      total: 0,
      human: 0,
      search: 0,
      ai: 0,
      other_bot: 0,
    });

    await getAnalyticsOverview(db, 30);

    const sql = vi.mocked(db.firstOrNull).mock.calls[0][0] as string;
    expect(sql).toContain("is_bot = 1 AND bot_category = 'search'");
    expect(sql).toContain("is_bot = 1 AND bot_category = 'ai'");
  });
});

describe("getAnalyticsDailyTrend", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns zero-filled daily trend", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    const result = await getAnalyticsDailyTrend(db, 3);

    // Should have rows for each day in the range (zero-filled)
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0].human).toBe(0);
  });
});

describe("getAnalyticsAggregates", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns countries, platforms, and browsers", async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({
        results: [{ country: "US", count: 100 }],
        meta: { changes: 0, duration: 1 },
      })
      .mockResolvedValueOnce({
        results: [{ os: "macOS", count: 80 }],
        meta: { changes: 0, duration: 1 },
      })
      .mockResolvedValueOnce({
        results: [{ browser: "Chrome", count: 90 }],
        meta: { changes: 0, duration: 1 },
      });

    const result = await getAnalyticsAggregates(db, 30);

    expect(result.countries).toHaveLength(1);
    expect(result.countries[0].country).toBe("US");
    expect(result.platforms).toHaveLength(1);
    expect(result.platforms[0].os).toBe("macOS");
    expect(result.browsers).toHaveLength(1);
    expect(result.browsers[0].browser).toBe("Chrome");
  });
});

describe("getHumanDetail", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns human detail with all sections", async () => {
    const emptyResults = { results: [], meta: { changes: 0, duration: 1 } };
    vi.mocked(db.query).mockResolvedValue(emptyResults);
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 42 });

    const result = await getHumanDetail(db, 30);

    expect(result.type).toBe("human");
    expect(result.recent24h).toBe(42);
    expect(result.topPages).toEqual([]);
  });
});

describe("getSearchDetail", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns search detail with type marker", async () => {
    const emptyResults = { results: [], meta: { changes: 0, duration: 1 } };
    vi.mocked(db.query).mockResolvedValue(emptyResults);

    const result = await getSearchDetail(db, 30);

    expect(result.type).toBe("search");
    expect(result.bots).toEqual([]);
    expect(result.dailyByBot).toEqual([]);
  });
});

describe("getAiBotDetail", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns AI bot detail with type marker", async () => {
    const emptyResults = { results: [], meta: { changes: 0, duration: 1 } };
    vi.mocked(db.query).mockResolvedValue(emptyResults);

    const result = await getAiBotDetail(db, 30);

    expect(result.type).toBe("ai");
    expect(result.bots).toEqual([]);
    expect(result.dailyByBot).toEqual([]);
  });
});

describe("getOtherBotDetail", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns other bot detail with all sub-categories", async () => {
    const emptyResults = { results: [], meta: { changes: 0, duration: 1 } };
    vi.mocked(db.query).mockResolvedValue(emptyResults);

    const result = await getOtherBotDetail(db, 30);

    expect(result.type).toBe("other");
    expect(result.byCategory).toEqual([]);
    expect(result.socialBots).toEqual([]);
    expect(result.monitorBots).toEqual([]);
    expect(result.unknownBots).toEqual([]);
  });
});
