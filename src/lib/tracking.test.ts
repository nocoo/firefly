import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mock functions so they're available in vi.mock factory
const { mockRecordPageView, mockFirstOrNull } = vi.hoisted(() => ({
  mockRecordPageView: vi.fn().mockResolvedValue(undefined),
  mockFirstOrNull: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/db", () => ({
  createDb: vi.fn(() => ({
    execute: vi.fn().mockResolvedValue({ changes: 1, duration: 0 }),
    firstOrNull: mockFirstOrNull,
  })),
}));

vi.mock("@/lib/hash", () => ({
  hashIp: vi.fn().mockResolvedValue("abc123hash"),
}));

vi.mock("@/data/analytics", () => ({
  recordPageView: mockRecordPageView,
}));

// Must import after mocks
import { trackPageView, resolvePostId, _resetSlugCache } from "./tracking";

describe("trackPageView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetSlugCache();
    process.env.WORKER_URL = "https://test.worker.dev";
    process.env.WORKER_SECRET = "test-secret";
  });

  it("calls recordPageView with parsed bot and device info", async () => {
    await trackPageView({
      path: "/2026/03/hello-world",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      ip: "192.168.1.1",
      referrer: "https://google.com",
      country: "US",
      city: "San Francisco",
    });

    expect(mockRecordPageView).toHaveBeenCalledOnce();
    const call = mockRecordPageView.mock.calls[0][1];
    expect(call.path).toBe("/2026/03/hello-world");
    expect(call.isBot).toBe(false);
    expect(call.deviceType).toBe("desktop");
    expect(call.browser).toBe("Chrome");
    expect(call.os).toBe("macOS");
    expect(call.ipHash).toBe("abc123hash");
    expect(call.referrer).toBe("https://google.com");
  });

  it("detects bot traffic correctly", async () => {
    await trackPageView({
      path: "/",
      userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)",
      ip: null,
      referrer: null,
      country: null,
      city: null,
    });

    expect(mockRecordPageView).toHaveBeenCalledOnce();
    const call = mockRecordPageView.mock.calls[0][1];
    expect(call.isBot).toBe(true);
    expect(call.botName).toBe("Googlebot");
    expect(call.botCategory).toBe("search");
    expect(call.deviceType).toBe("bot");
  });

  it("does not call recordPageView when WORKER_URL is missing", async () => {
    delete process.env.WORKER_URL;
    await expect(
      trackPageView({
        path: "/",
        userAgent: null,
        ip: null,
        referrer: null,
        country: null,
        city: null,
      }),
    ).resolves.toBeUndefined();
    expect(mockRecordPageView).not.toHaveBeenCalled();
  });

  it("passes null ipHash when ip is null", async () => {
    await trackPageView({
      path: "/test",
      userAgent: null,
      ip: null,
      referrer: null,
      country: null,
      city: null,
    });

    expect(mockRecordPageView).toHaveBeenCalledOnce();
    const call = mockRecordPageView.mock.calls[0][1];
    expect(call.ipHash).toBeNull();
  });

  it("does not throw when recordPageView fails", async () => {
    mockRecordPageView.mockRejectedValueOnce(new Error("DB down"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      trackPageView({
        path: "/",
        userAgent: null,
        ip: "1.2.3.4",
        referrer: null,
        country: null,
        city: null,
      }),
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });

  it("resolves postId for article paths and passes it to recordPageView", async () => {
    mockFirstOrNull.mockResolvedValueOnce({ id: "post-123" });

    await trackPageView({
      path: "/2026/03/hello-world",
      userAgent: "Mozilla/5.0 Chrome/120.0.0.0",
      ip: null,
      referrer: null,
      country: null,
      city: null,
    });

    expect(mockRecordPageView).toHaveBeenCalledOnce();
    const call = mockRecordPageView.mock.calls[0][1];
    expect(call.postId).toBe("post-123");
  });

  it("passes null postId for non-article paths", async () => {
    await trackPageView({
      path: "/",
      userAgent: "Mozilla/5.0 Chrome/120.0.0.0",
      ip: null,
      referrer: null,
      country: null,
      city: null,
    });

    expect(mockRecordPageView).toHaveBeenCalledOnce();
    const call = mockRecordPageView.mock.calls[0][1];
    expect(call.postId).toBeNull();
  });
});

describe("resolvePostId", () => {
  const mockDb = {
    firstOrNull: mockFirstOrNull,
  } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetSlugCache();
  });

  it("returns postId for valid article path", async () => {
    mockFirstOrNull.mockResolvedValueOnce({ id: "post-abc" });
    const result = await resolvePostId(mockDb, "/2024/06/my-article");
    expect(result).toBe("post-abc");
    expect(mockFirstOrNull).toHaveBeenCalledWith(
      "SELECT id FROM posts WHERE slug = ? AND status = 'published'",
      ["my-article"],
    );
  });

  it("returns null for homepage", async () => {
    const result = await resolvePostId(mockDb, "/");
    expect(result).toBeNull();
    expect(mockFirstOrNull).not.toHaveBeenCalled();
  });

  it("returns null for category page", async () => {
    const result = await resolvePostId(mockDb, "/category/tech");
    expect(result).toBeNull();
    expect(mockFirstOrNull).not.toHaveBeenCalled();
  });

  it("returns null for tag page", async () => {
    const result = await resolvePostId(mockDb, "/tag/ai");
    expect(result).toBeNull();
    expect(mockFirstOrNull).not.toHaveBeenCalled();
  });

  it("returns null for page path", async () => {
    const result = await resolvePostId(mockDb, "/page/2");
    expect(result).toBeNull();
    expect(mockFirstOrNull).not.toHaveBeenCalled();
  });

  it("returns null when post not found in DB", async () => {
    mockFirstOrNull.mockResolvedValueOnce(null);
    const result = await resolvePostId(mockDb, "/2024/01/nonexistent");
    expect(result).toBeNull();
  });

  it("returns null (degrades) when DB query fails", async () => {
    mockFirstOrNull.mockRejectedValueOnce(new Error("DB timeout"));
    const result = await resolvePostId(mockDb, "/2024/01/some-post");
    expect(result).toBeNull();
  });

  it("handles trailing slash in article path", async () => {
    mockFirstOrNull.mockResolvedValueOnce({ id: "post-slash" });
    const result = await resolvePostId(mockDb, "/2024/06/slug-here/");
    expect(result).toBe("post-slash");
  });

  it("returns null for paths with extra segments", async () => {
    const result = await resolvePostId(mockDb, "/2024/06/slug/extra");
    expect(result).toBeNull();
    expect(mockFirstOrNull).not.toHaveBeenCalled();
  });

  it("uses cache on second call for same slug", async () => {
    mockFirstOrNull.mockResolvedValueOnce({ id: "post-cached" });

    const r1 = await resolvePostId(mockDb, "/2024/06/cached-slug");
    const r2 = await resolvePostId(mockDb, "/2024/07/cached-slug");

    expect(r1).toBe("post-cached");
    expect(r2).toBe("post-cached");
    // DB should only have been called once
    expect(mockFirstOrNull).toHaveBeenCalledTimes(1);
  });

  it("uses cached null on second call for the same missing slug", async () => {
    mockFirstOrNull.mockResolvedValueOnce(null);

    const r1 = await resolvePostId(mockDb, "/2024/06/missing-slug");
    const r2 = await resolvePostId(mockDb, "/2024/07/missing-slug");

    expect(r1).toBeNull();
    expect(r2).toBeNull();
    expect(mockFirstOrNull).toHaveBeenCalledTimes(1);
  });
});
