import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { rateLimit, _testHelpers } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    _testHelpers.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request and reports remaining = limit - 1", () => {
    const result = rateLimit("1.1.1.1", 3, 1000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("allows requests up to the limit then blocks", () => {
    expect(rateLimit("ip", 3, 1000).allowed).toBe(true);
    expect(rateLimit("ip", 3, 1000).allowed).toBe(true);
    expect(rateLimit("ip", 3, 1000).allowed).toBe(true);
    const blocked = rateLimit("ip", 3, 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("does not consume quota when blocked", () => {
    rateLimit("ip", 1, 1000);
    rateLimit("ip", 1, 1000); // blocked
    rateLimit("ip", 1, 1000); // still blocked
    // Advance to expire the first allowed request.
    vi.advanceTimersByTime(1001);
    const next = rateLimit("ip", 1, 1000);
    expect(next.allowed).toBe(true);
  });

  it("isolates buckets per key", () => {
    expect(rateLimit("a", 1, 1000).allowed).toBe(true);
    expect(rateLimit("b", 1, 1000).allowed).toBe(true);
    // Different keys do not affect each other.
    expect(rateLimit("a", 1, 1000).allowed).toBe(false);
    expect(rateLimit("b", 1, 1000).allowed).toBe(false);
  });

  it("slides the window: a request expires after windowMs", () => {
    rateLimit("ip", 2, 1000);
    vi.advanceTimersByTime(500);
    rateLimit("ip", 2, 1000);
    // Now blocked.
    expect(rateLimit("ip", 2, 1000).allowed).toBe(false);
    // Advance enough for the first request to fall outside the window.
    vi.advanceTimersByTime(501);
    expect(rateLimit("ip", 2, 1000).allowed).toBe(true);
  });

  it("reports an accurate resetMs when blocked", () => {
    rateLimit("ip", 1, 1000); // recorded at t=0
    vi.advanceTimersByTime(300);
    const blocked = rateLimit("ip", 1, 1000);
    expect(blocked.allowed).toBe(false);
    // Oldest expires at t=1000, current is t=300 → reset in 700ms.
    expect(blocked.resetMs).toBe(700);
  });

  it("resetMs is never negative", () => {
    rateLimit("ip", 1, 1000);
    vi.advanceTimersByTime(2000);
    // After window expiration, the next call should be allowed and resetMs >= 0.
    const result = rateLimit("ip", 1, 1000);
    expect(result.allowed).toBe(true);
    expect(result.resetMs).toBeGreaterThanOrEqual(0);
  });

  it("reports remaining based on in-window request count", () => {
    const a = rateLimit("ip", 5, 1000);
    expect(a.remaining).toBe(4);
    const b = rateLimit("ip", 5, 1000);
    expect(b.remaining).toBe(3);
    const c = rateLimit("ip", 5, 1000);
    expect(c.remaining).toBe(2);
  });

  it("auto-cleans expired entries after the sweep interval", () => {
    rateLimit("temp", 5, 1000);
    expect(_testHelpers.size()).toBe(1);
    // Move past both the window and the sweep interval.
    vi.advanceTimersByTime(61_000);
    // Trigger a call on a different key to invoke sweep().
    rateLimit("other", 5, 1000);
    // The "temp" bucket should have been swept.
    expect(_testHelpers.size()).toBe(1); // only "other" remains
  });

  it("treats concurrent requests at the same instant correctly", () => {
    // All five recorded at the same Date.now() value.
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("ip", 5, 1000).allowed).toBe(true);
    }
    expect(rateLimit("ip", 5, 1000).allowed).toBe(false);
  });

  it("supports a limit of 0 (always blocks)", () => {
    const result = rateLimit("ip", 0, 1000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
