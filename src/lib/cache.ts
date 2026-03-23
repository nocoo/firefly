// ---------------------------------------------------------------------------
// Lightweight process-level cache with TTL
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  value: T;
  cachedAt: number;
}

/**
 * Create a process-level cache with a given TTL in milliseconds.
 *
 * Returns `{ get, set, invalidate }` — no dependencies beyond `Date.now()`.
 * Safe for server-side use where a single process handles many requests.
 *
 * @example
 * const cache = createCache<Category[]>(5 * 60 * 1000);
 * const categories = cache.get() ?? await fetchAndSet(cache);
 */
export function createCache<T>(ttl: number) {
  let entry: CacheEntry<T> | null = null;

  return {
    get(): T | null {
      if (entry && Date.now() - entry.cachedAt < ttl) return entry.value;
      return null;
    },
    set(value: T): void {
      entry = { value, cachedAt: Date.now() };
    },
    invalidate(): void {
      entry = null;
    },
  };
}
