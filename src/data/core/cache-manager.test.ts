import { describe, it, expect, vi, beforeEach } from "vitest";
import { EntityCacheManager } from "./cache-manager";

// ---------------------------------------------------------------------------
// EntityCacheManager
// ---------------------------------------------------------------------------

describe("EntityCacheManager", () => {
  let cache: EntityCacheManager<string[]>;

  beforeEach(() => {
    cache = new EntityCacheManager(1000); // 1 second TTL
  });

  // ---------------------------------------------------------------------------
  // get / set
  // ---------------------------------------------------------------------------

  it("returns null when cache is empty", () => {
    expect(cache.get()).toBeNull();
  });

  it("returns cached value after set", () => {
    cache.set(["hello"]);
    expect(cache.get()).toEqual(["hello"]);
  });

  it("returns null after TTL expires", () => {
    cache.set(["hello"]);
    vi.useFakeTimers();
    vi.advanceTimersByTime(1001);
    expect(cache.get()).toBeNull();
    vi.useRealTimers();
  });

  it("returns value within TTL", () => {
    cache.set(["hello"]);
    vi.useFakeTimers();
    vi.advanceTimersByTime(999);
    expect(cache.get()).toEqual(["hello"]);
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // invalidate
  // ---------------------------------------------------------------------------

  it("clears cache on invalidate", () => {
    cache.set(["hello"]);
    cache.invalidate();
    expect(cache.get()).toBeNull();
  });

  it("invalidate on empty cache is a no-op", () => {
    cache.invalidate();
    expect(cache.get()).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // overwrite
  // ---------------------------------------------------------------------------

  it("set overwrites previous value", () => {
    cache.set(["old"]);
    cache.set(["new"]);
    expect(cache.get()).toEqual(["new"]);
  });

  // ---------------------------------------------------------------------------
  // different TTL
  // ---------------------------------------------------------------------------

  it("respects custom TTL (5 min)", () => {
    const longCache = new EntityCacheManager<string>(5 * 60 * 1000);
    longCache.set("value");
    vi.useFakeTimers();
    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(longCache.get()).toBe("value");
    vi.advanceTimersByTime(60 * 1000);
    expect(longCache.get()).toBeNull();
    vi.useRealTimers();
  });
});
