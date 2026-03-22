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

    expect(db.execute).toHaveBeenCalledOnce();
    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("INSERT INTO page_views");
    expect(params).toHaveLength(15);
    expect(params![1]).toBe("p1"); // post_id
    expect(params![2]).toBe("/test"); // path
    expect(params![11]).toBe(0); // is_bot = false → 0
  });

  it("records bot views with is_bot = 1", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    await recordPageView(db, {
      path: "/test",
      isBot: true,
      botName: "Googlebot",
      botCategory: "search",
    });

    const [, params] = vi.mocked(db.execute).mock.calls[0];
    expect(params![11]).toBe(1); // is_bot = true → 1
    expect(params![12]).toBe("Googlebot");
    expect(params![13]).toBe("search");
  });

  it("defaults optional fields to null", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    await recordPageView(db, { path: "/minimal" });

    const [, params] = vi.mocked(db.execute).mock.calls[0];
    expect(params![1]).toBeNull(); // post_id
    expect(params![3]).toBeNull(); // referrer
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
