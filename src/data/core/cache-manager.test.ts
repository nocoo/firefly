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
    vi.useFakeTimers();
    cache.set(["hello"]);
    vi.advanceTimersByTime(1001);
    expect(cache.get()).toBeNull();
    vi.useRealTimers();
  });

  it("returns value within TTL", () => {
    // Install fake timers BEFORE set() so both `cachedAt` and the later
    // `Date.now()` read share the same frozen clock. If we install after
    // set(), coverage instrumentation adds enough real-time overhead
    // between the real-clock write and the fake-clock read that the
    // 999ms advance blows past the 1s TTL (observed in CI under
    // `test:coverage`).
    vi.useFakeTimers();
    cache.set(["hello"]);
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
    vi.useFakeTimers();
    longCache.set("value");
    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(longCache.get()).toBe("value");
    vi.advanceTimersByTime(60 * 1000);
    expect(longCache.get()).toBeNull();
    vi.useRealTimers();
  });
});
