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
 * Internal storage entry — includes lastModified for proper CacheHandlerValue return.
 */
interface StoredEntry {
  lastModified: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  tags?: string[];
}

// In-memory cache storage
const cache = new Map<string, StoredEntry>();
const metadata = new Map<string, CacheEntryMeta>();

// Tag invalidation timestamps
const tagRevalidatedAt = new Map<string, number>();

/**
 * Estimate the size of a cache entry in bytes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function estimateSize(value: any): number {
  if (!value) return 0;

  try {
    // Try JSON stringify for size estimation
    const str = JSON.stringify(value);
    return str.length;
  } catch {
    // Fallback: rough estimate
    return 1024;
  }
}

/**
 * Get cache statistics for monitoring.
 */
export function getCacheStats(): CacheStats {
  const entries = Array.from(metadata.values());

  const entriesByKind: Record<string, number> = {};
  const sizeByKind: Record<string, number> = {};
  let totalSizeBytes = 0;
  let oldestEntry: number | null = null;
  let newestEntry: number | null = null;

  for (const entry of entries) {
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
  const sortedEntries = [...entries].sort((a, b) => b.size - a.size);

  return {
    totalEntries: entries.length,
    totalSizeBytes,
    entriesByKind,
    sizeByKind,
    entries: sortedEntries.slice(0, 100), // Top 100 by size
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
    const stored = cache.get(key);

    if (!stored) {
      return null;
    }

    // Check if any tags have been invalidated
    const entryTags = stored.tags ?? [];
    for (const tag of entryTags) {
      const revalidatedTime = tagRevalidatedAt.get(tag);
      if (revalidatedTime && revalidatedTime > stored.lastModified) {
        // Entry is stale due to tag revalidation
        cache.delete(key);
        metadata.delete(key);
        return null;
      }
    }

    // Update access metadata
    const meta = metadata.get(key);
    if (meta) {
      meta.lastAccessedAt = Date.now();
      meta.accessCount += 1;
    }

    // Return in CacheHandlerValue format
    return {
      lastModified: stored.lastModified,
      value: stored.value,
    };
  }

  /**
   * Set a cache entry.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async set(key: string, data: any, ctx?: any): Promise<void> {
    const now = Date.now();

    // Extract tags from context
    const tags: string[] = ctx?.tags ?? [];

    // Store the entry
    cache.set(key, {
      lastModified: now,
      value: data,
      tags,
    });

    // Extract kind from the data for monitoring
    let kind = "unknown";
    let revalidate: number | null = null;

    if (data) {
      kind = data.kind ?? "unknown";
      if (typeof data.revalidate === "number") {
        revalidate = data.revalidate;
      }
    }

    // Store metadata for monitoring
    const existing = metadata.get(key);
    metadata.set(key, {
      key,
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
    for (const [key, stored] of cache.entries()) {
      const entryTags = stored.tags ?? [];
      if (entryTags.some((t) => tagList.includes(t))) {
        cache.delete(key);
        metadata.delete(key);
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
