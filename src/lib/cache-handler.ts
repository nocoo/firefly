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

// In-memory cache storage
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, any>();
const metadata = new Map<string, CacheEntryMeta>();

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
 */
export default class MonitoredCacheHandler {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async get(key: string): Promise<any> {
    const value = cache.get(key);

    // Update access metadata
    const meta = metadata.get(key);
    if (meta) {
      meta.lastAccessedAt = Date.now();
      meta.accessCount += 1;
    }

    return value ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async set(key: string, data: any, ctx?: any): Promise<void> {
    cache.set(key, data);

    // Extract kind from the entry
    let kind = "unknown";
    let tags: string[] = [];
    let revalidate: number | null = null;

    if (data) {
      kind = data.kind ?? "unknown";
      if (typeof data.revalidate === "number") {
        revalidate = data.revalidate;
      }
    }

    if (ctx?.tags && Array.isArray(ctx.tags)) {
      tags = ctx.tags;
    }

    // Store metadata
    const existing = metadata.get(key);
    metadata.set(key, {
      key,
      kind,
      size: estimateSize(data),
      createdAt: existing?.createdAt ?? Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: existing?.accessCount ?? 0,
      tags,
      revalidate,
    });
  }

  async revalidateTag(tags: string | string[]): Promise<void> {
    const tagList = Array.isArray(tags) ? tags : [tags];

    // Find and remove entries with matching tags
    for (const [key, meta] of metadata.entries()) {
      if (meta.tags.some((t) => tagList.includes(t))) {
        cache.delete(key);
        metadata.delete(key);
      }
    }
  }

  // Reset the request-level cache (called between requests)
  resetRequestCache(): void {
    // No-op for persistent cache
  }
}
