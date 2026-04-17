// ---------------------------------------------------------------------------
// Custom Cache Handler with Monitoring
// Tracks all cache entries for debugging and monitoring purposes.
// https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandler
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

// Single unified cache storage (replaces separate cache + metadata Maps)
const cache = new Map<string, UnifiedEntry>();

// Tag invalidation timestamps
const tagRevalidatedAt = new Map<string, number>();

// Tag string interning pool — avoids duplicate string allocations for common tags
const tagPool = new Map<string, string>();
function internTag(tag: string): string {
  const existing = tagPool.get(tag);
  if (existing) return existing;
  tagPool.set(tag, tag);
  return tag;
}
function internTags(tags: string[]): string[] {
  if (tags.length === 0) return tags;
  return tags.map(internTag);
}

/**
 * Estimate the size of a cache entry in bytes.
 * Uses sampling for large objects to avoid memory pressure from JSON.stringify.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function estimateSize(value: any): number {
  if (!value) return 0;

  // Fast path: use rough estimates based on type and structure
  // This avoids creating a full JSON string copy which doubles memory temporarily
  if (typeof value === 'string') return value.length;
  if (typeof value === 'number' || typeof value === 'boolean') return 8;
  if (value === null) return 4;
  
  // For objects, use a heuristic based on key count
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    // Rough estimate: 50 bytes per key on average
    return keys.length * 50 + 100;
  }

  return 256; // Default fallback
}

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

  for (const [key, entry] of cache.entries()) {
    // Build metadata view
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

    // Count by kind
    entriesByKind[entry.kind] = (entriesByKind[entry.kind] ?? 0) + 1;
    sizeByKind[entry.kind] = (sizeByKind[entry.kind] ?? 0) + entry.size;
    totalSizeBytes += entry.size;

    // Track oldest/newest
    if (oldestEntry === null || entry.createdAt < oldestEntry) {
      oldestEntry = entry.createdAt;
    }
    if (newestEntry === null || entry.createdAt > newestEntry) {
      newestEntry = entry.createdAt;
    }
  }

  // Sort entries by size descending for top consumers
  entries.sort((a, b) => b.size - a.size);

  return {
    totalEntries: entries.length,
    totalSizeBytes,
    entriesByKind,
    sizeByKind,
    entries: entries.slice(0, 100), // Top 100 by size
    oldestEntry,
    newestEntry,
  };
}

/**
 * Custom cache handler class that tracks all entries.
 * Implements the Next.js CacheHandler interface.
 */
export default class MonitoredCacheHandler {

  /**
   * Get a cache entry.
   * Must return CacheHandlerValue format or null.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async get(key: string, _ctx?: any): Promise<CacheHandlerValue | null> {
    const entry = cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if any tags have been invalidated
    for (const tag of entry.tags) {
      const revalidatedTime = tagRevalidatedAt.get(tag);
      if (revalidatedTime && revalidatedTime > entry.lastModified) {
        // Entry is stale due to tag revalidation
        cache.delete(key);
        return null;
      }
    }

    // Update access metadata (in-place mutation)
    entry.lastAccessedAt = Date.now();
    entry.accessCount += 1;

    // Return in CacheHandlerValue format
    return {
      lastModified: entry.lastModified,
      value: entry.value,
    };
  }

  /**
   * Set a cache entry.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async set(key: string, data: any, ctx?: any): Promise<void> {
    const now = Date.now();

    // Extract tags from context and intern them to reduce string duplication
    const tags: string[] = internTags(ctx?.tags ?? []);

    // Extract kind from the data for monitoring
    let kind = "unknown";
    let revalidate: number | null = null;

    if (data) {
      kind = data.kind ?? "unknown";
      if (typeof data.revalidate === "number") {
        revalidate = data.revalidate;
      }
    }

    // Get existing entry for createdAt/accessCount preservation
    const existing = cache.get(key);

    // Store unified entry
    cache.set(key, {
      lastModified: now,
      value: data,
      kind,
      size: estimateSize(data),
      createdAt: existing?.createdAt ?? now,
      lastAccessedAt: now,
      accessCount: existing?.accessCount ?? 0,
      tags,
      revalidate,
    });
  }

  /**
   * Revalidate entries by tag.
   */
  async revalidateTag(tags: string | string[]): Promise<void> {
    const tagList = Array.isArray(tags) ? tags : [tags];
    const now = Date.now();

    // Mark tags as revalidated
    for (const tag of tagList) {
      tagRevalidatedAt.set(tag, now);
    }

    // Remove entries with matching tags
    for (const [key, entry] of cache.entries()) {
      if (entry.tags.some((t) => tagList.includes(t))) {
        cache.delete(key);
      }
    }
  }

  /**
   * Reset the request-level cache (called between requests).
   */
  resetRequestCache(): void {
    // No-op for persistent cache
  }
}
