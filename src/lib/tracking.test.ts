import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mock functions so they're available in vi.mock factory
const { mockRecordPageView } = vi.hoisted(() => ({
  mockRecordPageView: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
  createDb: vi.fn(() => ({
    execute: vi.fn().mockResolvedValue({ changes: 1, duration: 0 }),
  })),
}));

vi.mock("@/lib/hash", () => ({
  hashIp: vi.fn().mockResolvedValue("abc123hash"),
}));

vi.mock("@/data/analytics", () => ({
  recordPageView: mockRecordPageView,
}));

import { trackPageView } from "./tracking";

describe("trackPageView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
