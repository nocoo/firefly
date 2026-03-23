import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCache } from "./cache";

describe("createCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null on empty cache", () => {
    const cache = createCache<string>(1000);
    expect(cache.get()).toBeNull();
  });

  it("returns cached value within TTL", () => {
    const cache = createCache<string>(1000);
    cache.set("hello");
    expect(cache.get()).toBe("hello");
  });

  it("returns null after TTL expires", () => {
    const cache = createCache<string>(1000);
    cache.set("hello");
    vi.advanceTimersByTime(1001);
    expect(cache.get()).toBeNull();
  });

  it("returns value just before TTL expires", () => {
    const cache = createCache<string>(1000);
    cache.set("hello");
    vi.advanceTimersByTime(999);
    expect(cache.get()).toBe("hello");
  });

  it("invalidate clears the cache", () => {
    const cache = createCache<string>(1000);
    cache.set("hello");
    cache.invalidate();
    expect(cache.get()).toBeNull();
  });

  it("set overwrites previous value", () => {
    const cache = createCache<string>(1000);
    cache.set("first");
    cache.set("second");
    expect(cache.get()).toBe("second");
  });

  it("set resets TTL", () => {
    const cache = createCache<string>(1000);
    cache.set("first");
    vi.advanceTimersByTime(800);
    cache.set("second");
    vi.advanceTimersByTime(800);
    // 800ms since last set, should still be valid
    expect(cache.get()).toBe("second");
  });

  it("works with object values", () => {
    const cache = createCache<{ items: string[] }>(1000);
    const value = { items: ["a", "b"] };
    cache.set(value);
    expect(cache.get()).toBe(value);
  });
});
