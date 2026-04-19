// ---------------------------------------------------------------------------
// Custom Cache Handler with bounded in-memory LRU.
// https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandler
// ---------------------------------------------------------------------------

import { LRUCache } from "lru-cache";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Maximum entries in the in-memory LRU cache. */
const LRU_MAX_ENTRIES = 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Cache entry metadata for monitoring.
 */
export interface CacheEntryMeta {
  key: string;
  kind: string;
  size: number; // Approximate size in bytes
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  tags: string[];
  revalidate: number | null;
}

/**
 * Cache statistics snapshot.
 */
export interface CacheStats {
  totalEntries: number;
  totalSizeBytes: number;
  entriesByKind: Record<string, number>;
  sizeByKind: Record<string, number>;
  entries: CacheEntryMeta[];
  oldestEntry: number | null;
  newestEntry: number | null;
}

/**
 * Next.js CacheHandlerValue interface.
 * This is what get() must return.
 */
interface CacheHandlerValue {
  lastModified: number;
  age?: number;
  cacheState?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any | null;
}

/**
 * Unified storage entry — combines value and metadata to reduce Map overhead.
 */
interface UnifiedEntry {
  // Value storage (required for CacheHandlerValue)
  lastModified: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  // Metadata (for monitoring)
  kind: string;
  size: number;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  tags: string[];
  revalidate: number | null;
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

// LRU cache for hot data (bounded memory)
const lruCache = new LRUCache<string, UnifiedEntry>({ max: LRU_MAX_ENTRIES });

// Tag invalidation timestamps (in-memory only — lost on restart)
const tagRevalidatedAt = new Map<string, number>();

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Estimate the size of a cache entry in bytes.
 * Uses JSON.stringify for accurate measurement.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function estimateSize(value: any): number {
  if (!value) return 0;

  try {
    return JSON.stringify(value).length;
  } catch {
    return 1024;
  }
}

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

/**
 * Get cache statistics for monitoring.
 */
export function getCacheStats(): CacheStats {
  const entries: CacheEntryMeta[] = [];
  const entriesByKind: Record<string, number> = {};
  const sizeByKind: Record<string, number> = {};
  let totalSizeBytes = 0;
  let oldestEntry: number | null = null;
  let newestEntry: number | null = null;

  for (const [key, entry] of lruCache.entries()) {
    const meta: CacheEntryMeta = {
      key,
      kind: entry.kind,
      size: entry.size,
      createdAt: entry.createdAt,
      lastAccessedAt: entry.lastAccessedAt,
      accessCount: entry.accessCount,
      tags: entry.tags,
      revalidate: entry.revalidate,
    };
    entries.push(meta);

    entriesByKind[entry.kind] = (entriesByKind[entry.kind] ?? 0) + 1;
    sizeByKind[entry.kind] = (sizeByKind[entry.kind] ?? 0) + entry.size;
    totalSizeBytes += entry.size;

    if (oldestEntry === null || entry.createdAt < oldestEntry) {
      oldestEntry = entry.createdAt;
    }
    if (newestEntry === null || entry.createdAt > newestEntry) {
      newestEntry = entry.createdAt;
    }
  }

  entries.sort((a, b) => b.size - a.size);

  return {
    totalEntries: entries.length,
    totalSizeBytes,
    entriesByKind,
    sizeByKind,
    entries: entries.slice(0, 100),
    oldestEntry,
    newestEntry,
  };
}

// ---------------------------------------------------------------------------
// Test helpers (internal use only)
// ---------------------------------------------------------------------------

/** @internal Reset all cache state for testing. */
export function _resetCacheState(): void {
  lruCache.clear();
  tagRevalidatedAt.clear();
}

/** @internal Get the tag revalidation map for testing. */
export function _getTagRevalidatedAt(): Map<string, number> {
  return tagRevalidatedAt;
}

/** @internal Get the LRU cache for testing. */
export function _getLRUCache(): LRUCache<string, UnifiedEntry> {
  return lruCache;
}

// ---------------------------------------------------------------------------
// Cache Handler
// ---------------------------------------------------------------------------

/**
 * Custom cache handler backed by a bounded in-memory LRU.
 *
 * Cache state is process-local: it is lost on restart and is not shared
 * across instances. This is acceptable for a single-instance Railway
 * deployment — Next.js will regenerate misses on demand.
 */
export default class CacheHandler {
  /**
   * Get a cache entry from the LRU and validate it against tag revalidation
   * timestamps. Returns null on miss or when the entry is stale.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async get(key: string, _ctx?: any): Promise<CacheHandlerValue | null> {
    const entry = lruCache.get(key);
    if (!entry) return null;

    // Check tag invalidation
    for (const tag of entry.tags) {
      const revalidatedTime = tagRevalidatedAt.get(tag);
      if (revalidatedTime && revalidatedTime > entry.lastModified) {
        // Entry is stale due to tag invalidation
        lruCache.delete(key);
        return null;
      }
    }

    // Update access metadata
    entry.lastAccessedAt = Date.now();
    entry.accessCount += 1;

    return {
      lastModified: entry.lastModified,
      value: entry.value,
    };
  }

  /**
   * Set a cache entry in the LRU.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async set(key: string, data: any, ctx?: any): Promise<void> {
    const now = Date.now();
    const tags: string[] = ctx?.tags ?? [];

    let kind = "unknown";
    let revalidate: number | null = null;

    if (data) {
      kind = data.kind ?? "unknown";
      if (typeof data.revalidate === "number") {
        revalidate = data.revalidate;
      }
    }

    const existing = lruCache.get(key);

    const entry: UnifiedEntry = {
      lastModified: now,
      value: data,
      kind,
      size: estimateSize(data),
      createdAt: existing?.createdAt ?? now,
      lastAccessedAt: now,
      accessCount: existing?.accessCount ?? 0,
      tags,
      revalidate,
    };

    lruCache.set(key, entry);
  }

  /**
   * Revalidate entries by tag.
   * Updates in-memory tag timestamps and clears matching LRU entries.
   */
  async revalidateTag(tags: string | string[]): Promise<void> {
    const tagList = Array.isArray(tags) ? tags : [tags];
    const now = Date.now();

    // Update tag timestamps
    for (const tag of tagList) {
      tagRevalidatedAt.set(tag, now);
    }

    // Clear matching entries from LRU
    for (const [key, entry] of lruCache.entries()) {
      if (entry.tags.some((t) => tagList.includes(t))) {
        lruCache.delete(key);
      }
    }
  }

  /**
   * Reset the request-level cache (called between requests).
   * No-op for persistent cache.
   */
  resetRequestCache(): void {
    // No-op for persistent cache
  }
}
