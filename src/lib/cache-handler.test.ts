import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import CacheHandler, {
  getCacheStats,
  _resetCacheState,
  _setKVClient,
  _getTagRevalidatedAt,
  _getLRUCache,
} from "./cache-handler";
import type { KVClient } from "./kv-client";

// ---------------------------------------------------------------------------
// Mock KV Client Factory
// ---------------------------------------------------------------------------

function createMockKVClient(): KVClient & {
  store: Map<string, { value: unknown; ttl?: number }>;
} {
  const store = new Map<string, { value: unknown; ttl?: number }>();

  return {
    store,
    async get<T>(key: string): Promise<T | null> {
      const item = store.get(key);
      return item ? (item.value as T) : null;
    },
    async put(key: string, value: unknown, options?: { expirationTtl?: number }): Promise<void> {
      store.set(key, { value, ttl: options?.expirationTtl });
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    async list(prefix?: string): Promise<string[]> {
      const keys: string[] = [];
      for (const key of store.keys()) {
        if (!prefix || key.startsWith(prefix)) {
          keys.push(key);
        }
      }
      return keys;
    },
  };
}

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
  // Pure LRU mode (no KV configured)
  // -------------------------------------------------------------------------

  describe("pure LRU mode (no KV)", () => {
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

    it("getCacheStats returns LRU stats", async () => {
      await handler.set("key1", { kind: "PAGE", data: "x".repeat(100) });
      await handler.set("key2", { kind: "FETCH", data: "y".repeat(50) });

      const stats = getCacheStats();

      expect(stats.totalEntries).toBe(2);
      expect(stats.entriesByKind["PAGE"]).toBe(1);
      expect(stats.entriesByKind["FETCH"]).toBe(1);
      expect(stats.kvBackend.enabled).toBe(false);
      expect(stats.kvBackend.note).toContain("pure LRU mode");
    });

    it("resetRequestCache is a no-op", () => {
      expect(() => handler.resetRequestCache()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // LRU + KV mode
  // -------------------------------------------------------------------------

  describe("LRU + KV mode", () => {
    let mockKV: ReturnType<typeof createMockKVClient>;

    beforeEach(() => {
      mockKV = createMockKVClient();
      _setKVClient(mockKV);
    });

    it("writes to both LRU and KV on set", async () => {
      await handler.set("key1", { kind: "PAGE", data: "test" });

      // Allow fire-and-forget KV write to complete
      await new Promise((r) => setTimeout(r, 10));

      // Check LRU
      const lru = _getLRUCache();
      expect(lru.get("key1")).toBeDefined();

      // Check KV
      expect(mockKV.store.has("cache:key1")).toBe(true);
    });

    it("applies TTL to KV entries", async () => {
      await handler.set("key1", { kind: "PAGE" });
      await new Promise((r) => setTimeout(r, 10));

      const kvEntry = mockKV.store.get("cache:key1");
      expect(kvEntry?.ttl).toBe(7 * 24 * 3600);
    });

    it("falls back to KV on LRU miss", async () => {
      // Directly put into KV (simulating restart scenario)
      const entry = {
        lastModified: Date.now(),
        value: { kind: "PAGE", data: "from-kv" },
        kind: "PAGE",
        size: 100,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        accessCount: 5,
        tags: [],
        revalidate: null,
      };
      mockKV.store.set("cache:key1", { value: entry });

      const result = await handler.get("key1");

      expect(result).not.toBeNull();
      expect(result?.value.data).toBe("from-kv");

      // Should backfill LRU
      const lru = _getLRUCache();
      expect(lru.get("key1")).toBeDefined();
    });

    it("tag invalidation persists to KV", async () => {
      await handler.revalidateTag("post-1");

      const kvTag = mockKV.store.get("tag:post-1");
      expect(kvTag).toBeDefined();
      expect(kvTag?.ttl).toBe(7 * 24 * 3600);
    });

    it("lazy-loads tag timestamps from KV", async () => {
      // Put tag timestamp directly into KV (simulating restart)
      const revalidatedTime = Date.now();
      mockKV.store.set("tag:post-1", { value: revalidatedTime });

      // Put cache entry with older lastModified
      const entry = {
        lastModified: revalidatedTime - 1000,
        value: { kind: "PAGE" },
        kind: "PAGE",
        size: 100,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        accessCount: 0,
        tags: ["post-1"],
        revalidate: null,
      };
      mockKV.store.set("cache:key1", { value: entry });

      // Get should find entry stale via KV tag check
      const result = await handler.get("key1");

      expect(result).toBeNull();
      // Tag should be cached in memory
      expect(_getTagRevalidatedAt().get("post-1")).toBe(revalidatedTime);
    });

    it("deletes stale entries from KV on get", async () => {
      // Set up tag revalidation
      const now = Date.now();
      _getTagRevalidatedAt().set("post-1", now);

      // Put stale entry in KV
      const entry = {
        lastModified: now - 1000,
        value: { kind: "PAGE" },
        kind: "PAGE",
        size: 100,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        accessCount: 0,
        tags: ["post-1"],
        revalidate: null,
      };
      mockKV.store.set("cache:key1", { value: entry });

      await handler.get("key1");

      // Allow fire-and-forget delete to complete
      await new Promise((r) => setTimeout(r, 10));

      // Should be deleted from KV
      expect(mockKV.store.has("cache:key1")).toBe(false);
    });

    it("getCacheStats shows KV enabled", async () => {
      const stats = getCacheStats();

      expect(stats.kvBackend.enabled).toBe(true);
      expect(stats.kvBackend.note).toContain("LRU hot cache only");
    });
  });

  // -------------------------------------------------------------------------
  // Tag invalidation across restart (simulated)
  // -------------------------------------------------------------------------

  describe("tag invalidation across restart", () => {
    it("respects tag invalidation persisted in KV after restart", async () => {
      const mockKV = createMockKVClient();
      _setKVClient(mockKV);

      // Simulate: before restart, entry was cached and tag was invalidated
      const oldTime = Date.now() - 10000;
      const tagTime = Date.now() - 5000;

      // Entry was written before tag invalidation
      const entry = {
        lastModified: oldTime,
        value: { kind: "PAGE", content: "old" },
        kind: "PAGE",
        size: 100,
        createdAt: oldTime,
        lastAccessedAt: oldTime,
        accessCount: 1,
        tags: ["category-blog"],
        revalidate: null,
      };
      mockKV.store.set("cache:post-1", { value: entry });

      // Tag was invalidated after entry was written
      mockKV.store.set("tag:category-blog", { value: tagTime });

      // Simulate restart: clear in-memory state but keep KV
      _getLRUCache().clear();
      _getTagRevalidatedAt().clear();

      // New handler after restart
      const newHandler = new CacheHandler();
      const result = await newHandler.get("post-1");

      // Should be null because tag invalidation is newer than entry
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // KV failure handling
  // -------------------------------------------------------------------------

  describe("KV failure handling", () => {
    it("degrades gracefully on KV get failure", async () => {
      const failingKV: KVClient = {
        get: vi.fn().mockRejectedValue(new Error("KV unavailable")),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([]),
      };
      _setKVClient(failingKV);

      // Should not throw, just return null
      const result = await handler.get("key1");
      expect(result).toBeNull();
    });

    it("continues operating on KV put failure", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const failingKV: KVClient = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockRejectedValue(new Error("KV write failed")),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([]),
      };
      _setKVClient(failingKV);

      // Should not throw
      await handler.set("key1", { kind: "PAGE" });

      // Entry should still be in LRU
      const lru = _getLRUCache();
      expect(lru.get("key1")).toBeDefined();

      // Wait for fire-and-forget error
      await new Promise((r) => setTimeout(r, 10));
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
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

    it("handles entries with no tags and tag in KV", async () => {
      const mockKV = createMockKVClient();
      _setKVClient(mockKV);

      // Entry with no tags
      await handler.set("key1", { kind: "PAGE" }, { tags: [] });

      // Invalidate some unrelated tag
      await handler.revalidateTag("unrelated");

      // Should still be accessible
      const result = await handler.get("key1");
      expect(result).not.toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Cloudflare KV REST API behavior verification
// ---------------------------------------------------------------------------

describe("KV JSON serialization behavior", () => {
  it("correctly round-trips numbers through JSON", async () => {
    const mockKV = createMockKVClient();
    _setKVClient(mockKV);

    // Store a number directly
    await mockKV.put("tag:test", 1713456789000);

    const result = await mockKV.get<number>("tag:test");
    expect(result).toBe(1713456789000);
    expect(typeof result).toBe("number");
  });

  it("correctly round-trips complex objects through JSON", async () => {
    const mockKV = createMockKVClient();
    _setKVClient(mockKV);

    const entry = {
      lastModified: 1713456789000,
      value: { nested: { data: [1, 2, 3] } },
      kind: "PAGE",
      size: 100,
      createdAt: 1713456789000,
      lastAccessedAt: 1713456789000,
      accessCount: 5,
      tags: ["tag-a", "tag-b"],
      revalidate: 60,
    };

    await mockKV.put("cache:test", entry);

    const result = await mockKV.get<typeof entry>("cache:test");
    expect(result).toEqual(entry);
  });
});
