// ---------------------------------------------------------------------------
// Post entity caches — count cache (LRU + TTL) + archives cache
// ---------------------------------------------------------------------------

import { createCache } from "@/lib/cache";
import type { MonthlyArchive } from "./post-types";

const COUNT_TTL = 5 * 60 * 1000;
const COUNT_MAX_SIZE = 64;

interface CountEntry {
  value: number;
  cachedAt: number;
}

const countCache = new Map<string, CountEntry>();

export function countCacheKey(where: string, params: unknown[]): string {
  return `${where}|${JSON.stringify(params)}`;
}

/** Get a count cache entry, evicting it if expired. */
export function countCacheGet(key: string): CountEntry | undefined {
  const entry = countCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt >= COUNT_TTL) {
    countCache.delete(key);
    return undefined;
  }
  return entry;
}

/** Set a count cache entry, evicting oldest entries when at capacity. */
export function countCacheSet(key: string, entry: CountEntry): void {
  // Delete first so re-insert moves it to the end (Map insertion order)
  countCache.delete(key);
  if (countCache.size >= COUNT_MAX_SIZE) {
    // Evict oldest entry (first in insertion order)
    const oldest = countCache.keys().next().value;
    if (oldest !== undefined) countCache.delete(oldest);
  }
  countCache.set(key, entry);
}

export const archivesCache = createCache<MonthlyArchive[]>(5 * 60 * 1000);

/** Force all post caches to expire (count + archives). */
export function invalidatePostCaches(): void {
  countCache.clear();
  archivesCache.invalidate();
}
