// ---------------------------------------------------------------------------
// Entity cache manager — wraps createCache for entity-level caching
// ---------------------------------------------------------------------------

import { createCache } from "@/lib/cache";

/**
 * Typed cache wrapper for entity data.
 * Used by entities with `listMode: "all"` to cache the full array.
 */
export class EntityCacheManager<T> {
  private cache: ReturnType<typeof createCache<T>>;

  constructor(ttl: number) {
    this.cache = createCache<T>(ttl);
  }

  /** Get cached value, or null if expired/empty. */
  get(): T | null {
    return this.cache.get();
  }

  /** Set cache value. */
  set(value: T): void {
    this.cache.set(value);
  }

  /** Invalidate (clear) the cache. */
  invalidate(): void {
    this.cache.invalidate();
  }
}
