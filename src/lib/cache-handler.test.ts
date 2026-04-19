import { describe, it, expect, beforeEach, afterEach } from "vitest";
import CacheHandler, {
  getCacheStats,
  _resetCacheState,
  _getTagRevalidatedAt,
  _getLRUCache,
} from "./cache-handler";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CacheHandler", () => {
  let handler: CacheHandler;

  beforeEach(() => {
    _resetCacheState();
    handler = new CacheHandler();
  });

  afterEach(() => {
    _resetCacheState();
  });

  // -------------------------------------------------------------------------
  // Pure LRU mode
  // -------------------------------------------------------------------------

  describe("pure LRU mode", () => {
    it("stores and retrieves entries from LRU", async () => {
      await handler.set("key1", { kind: "PAGE", data: "test" });

      const result = await handler.get("key1");

      expect(result).not.toBeNull();
      expect(result?.value).toEqual({ kind: "PAGE", data: "test" });
      expect(result?.lastModified).toBeGreaterThan(0);
    });

    it("returns null for missing keys", async () => {
      const result = await handler.get("nonexistent");
      expect(result).toBeNull();
    });

    it("tracks access count", async () => {
      await handler.set("key1", { kind: "PAGE" });

      await handler.get("key1");
      await handler.get("key1");
      await handler.get("key1");

      const lru = _getLRUCache();
      const entry = lru.get("key1");
      expect(entry?.accessCount).toBe(3);
    });

    it("preserves createdAt across updates", async () => {
      await handler.set("key1", { kind: "PAGE" });
      const lru = _getLRUCache();
      const originalCreatedAt = lru.get("key1")?.createdAt;

      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));
      await handler.set("key1", { kind: "PAGE", updated: true });

      expect(lru.get("key1")?.createdAt).toBe(originalCreatedAt);
    });

    it("invalidates entries by tag", async () => {
      await handler.set("key1", { kind: "PAGE" }, { tags: ["post-1"] });
      await handler.set("key2", { kind: "PAGE" }, { tags: ["post-2"] });

      await handler.revalidateTag("post-1");

      expect(await handler.get("key1")).toBeNull();
      expect(await handler.get("key2")).not.toBeNull();
    });

    it("invalidates entries by multiple tags", async () => {
      await handler.set("key1", { kind: "PAGE" }, { tags: ["post-1", "category-a"] });
      await handler.set("key2", { kind: "PAGE" }, { tags: ["post-2"] });

      await handler.revalidateTag(["post-1", "post-2"]);

      expect(await handler.get("key1")).toBeNull();
      expect(await handler.get("key2")).toBeNull();
    });

    it("records tag revalidation timestamps in memory", async () => {
      await handler.revalidateTag("post-1");
      const ts = _getTagRevalidatedAt().get("post-1");
      expect(ts).toBeDefined();
      expect(typeof ts).toBe("number");
    });

    it("getCacheStats returns LRU stats", async () => {
      await handler.set("key1", { kind: "PAGE", data: "x".repeat(100) });
      await handler.set("key2", { kind: "FETCH", data: "y".repeat(50) });

      const stats = getCacheStats();

      expect(stats.totalEntries).toBe(2);
      expect(stats.entriesByKind["PAGE"]).toBe(1);
      expect(stats.entriesByKind["FETCH"]).toBe(1);
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
    });

    it("resetRequestCache is a no-op", () => {
      expect(() => handler.resetRequestCache()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles null data", async () => {
      await handler.set("null-key", null);
      const result = await handler.get("null-key");
      expect(result?.value).toBeNull();
    });

    it("handles empty tags array", async () => {
      await handler.set("key1", { kind: "PAGE" }, { tags: [] });
      const result = await handler.get("key1");
      expect(result).not.toBeNull();
    });

    it("handles revalidateTag with empty array", async () => {
      await handler.set("key1", { kind: "PAGE" });
      await handler.revalidateTag([]);
      const result = await handler.get("key1");
      expect(result).not.toBeNull();
    });

    it("extracts revalidate from data", async () => {
      await handler.set("key1", { kind: "PAGE", revalidate: 60 });
      const lru = _getLRUCache();
      expect(lru.get("key1")?.revalidate).toBe(60);
    });

    it("entries without tags are not affected by unrelated tag invalidation", async () => {
      await handler.set("key1", { kind: "PAGE" }, { tags: [] });
      await handler.revalidateTag("unrelated");
      const result = await handler.get("key1");
      expect(result).not.toBeNull();
    });
  });
});
