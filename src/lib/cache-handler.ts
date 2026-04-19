// ---------------------------------------------------------------------------
// Custom Cache Handler with LRU + Cloudflare KV
// Two-layer cache: hot data in memory LRU, cold data in Cloudflare KV.
// https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandler
// ---------------------------------------------------------------------------

import { LRUCache } from "lru-cache";
import { createKVClient, type KVClient } from "./kv-client";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Maximum entries in the in-memory LRU cache. */
const LRU_MAX_ENTRIES = 100;

/** TTL for KV entries in seconds (7 days). */
const KV_TTL_SECONDS = 7 * 24 * 3600;

/**
 * Check if we're in build phase. During build, KV is disabled to reduce
 * memory pressure from 47+ parallel static generation workers.
 * NEXT_PHASE is set by Next.js: "phase-production-build" during build.
 */
const IS_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build";

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
 * KV backend status for monitoring.
 */
export interface KVBackendStatus {
  enabled: boolean;
  note: string;
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
  kvBackend: KVBackendStatus;
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
 * This is also the structure stored in KV.
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

// Tag invalidation timestamps (in-memory, lazy-loaded from KV)
const tagRevalidatedAt = new Map<string, number>();

// Lazy-initialized KV client singleton
let kvClient: KVClient | null = null;
let kvClientInitialized = false;

/**
 * Get or create the KV client. Returns null if not configured or during build.
 * Uses lazy initialization to avoid startup overhead when KV is not used.
 * IMPORTANT: Disabled during build phase to prevent OOM from 47+ workers.
 */
function getKVClient(): KVClient | null {
  // Disable KV during build to prevent OOM
  if (IS_BUILD_PHASE) return null;

  if (kvClientInitialized) return kvClient;

  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;
  const namespaceId = process.env.KV_NAMESPACE_ID;

  if (accountId && apiToken && namespaceId) {
    kvClient = createKVClient(accountId, namespaceId, apiToken);
  }
  kvClientInitialized = true;
  return kvClient;
}

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
 * Note: Only reflects LRU hot cache; KV cold storage is not included.
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

  const kv = getKVClient();
  return {
    totalEntries: entries.length,
    totalSizeBytes,
    entriesByKind,
    sizeByKind,
    entries: entries.slice(0, 100),
    oldestEntry,
    newestEntry,
    kvBackend: {
      enabled: kv !== null,
      note: IS_BUILD_PHASE
        ? "KV disabled during build phase"
        : kv
          ? "Stats reflect LRU hot cache only; KV cold storage not included"
          : "KV not configured; using pure LRU mode",
    },
  };
}

// ---------------------------------------------------------------------------
// Test helpers (internal use only)
// ---------------------------------------------------------------------------

/** @internal Reset all cache state for testing. */
export function _resetCacheState(): void {
  lruCache.clear();
  tagRevalidatedAt.clear();
  kvClient = null;
  kvClientInitialized = false;
}

/** @internal Inject a mock KV client for testing. */
export function _setKVClient(client: KVClient | null): void {
  kvClient = client;
  kvClientInitialized = true;
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
 * Custom cache handler with two-layer storage:
 * - Hot data: In-memory LRU cache (bounded by LRU_MAX_ENTRIES)
 * - Cold data: Cloudflare KV (optional, configured via environment variables)
 *
 * When KV is not configured, operates in pure LRU mode (graceful degradation).
 */
export default class CacheHandler {
  /**
   * Get a cache entry.
   * 1. Check LRU cache
   * 2. If miss, check KV (if configured)
   * 3. Validate against tag invalidation timestamps
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async get(key: string, _ctx?: any): Promise<CacheHandlerValue | null> {
    // 1. Check LRU cache
    let entry = lruCache.get(key);

    // 2. LRU miss → check KV
    if (!entry) {
      const kv = getKVClient();
      if (kv) {
        try {
          const kvEntry = await kv.get<UnifiedEntry>(`cache:${key}`);
          if (kvEntry) {
            entry = kvEntry;
            lruCache.set(key, entry); // Backfill LRU
          }
        } catch (err) {
          // KV read failure — degrade gracefully
          console.error(`[cache] KV get failed for ${key}:`, (err as Error).message);
        }
      }
    }

    if (!entry) return null;

    // 3. Check tag invalidation
    for (const tag of entry.tags) {
      let revalidatedTime = tagRevalidatedAt.get(tag);

      // Lazy-load tag timestamp from KV if not in memory
      if (revalidatedTime === undefined) {
        const kv = getKVClient();
        if (kv) {
          try {
            const kvTime = await kv.get<number>(`tag:${tag}`);
            if (kvTime !== null) {
              tagRevalidatedAt.set(tag, kvTime);
              revalidatedTime = kvTime;
            }
          } catch {
            // KV read failure — continue without tag check
          }
        }
      }

      if (revalidatedTime && revalidatedTime > entry.lastModified) {
        // Entry is stale due to tag invalidation
        lruCache.delete(key);
        // Lazy delete from KV (fire-and-forget)
        const kv = getKVClient();
        if (kv) {
          kv.delete(`cache:${key}`).catch(() => {});
        }
        return null;
      }
    }

    // 4. Update access metadata
    entry.lastAccessedAt = Date.now();
    entry.accessCount += 1;

    return {
      lastModified: entry.lastModified,
      value: entry.value,
    };
  }

  /**
   * Set a cache entry.
   * Writes to both LRU and KV (if configured).
   * KV write is fire-and-forget to avoid blocking.
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

    // Write to LRU
    lruCache.set(key, entry);

    // Write to KV (fire-and-forget with TTL)
    const kv = getKVClient();
    if (kv) {
      kv.put(`cache:${key}`, entry, { expirationTtl: KV_TTL_SECONDS }).catch((err) => {
        console.error(`[cache] KV put failed for ${key}:`, (err as Error).message);
      });
    }
  }

  /**
   * Revalidate entries by tag.
   * - Updates in-memory tag timestamps
   * - Clears matching entries from LRU
   * - Persists tag timestamps to KV (if configured)
   */
  async revalidateTag(tags: string | string[]): Promise<void> {
    const tagList = Array.isArray(tags) ? tags : [tags];
    const now = Date.now();
    const kv = getKVClient();

    // 1. Update in-memory tag timestamps
    for (const tag of tagList) {
      tagRevalidatedAt.set(tag, now);
    }

    // 2. Clear matching entries from LRU
    for (const [key, entry] of lruCache.entries()) {
      if (entry.tags.some((t) => tagList.includes(t))) {
        lruCache.delete(key);
      }
    }

    // 3. Persist tag timestamps to KV (each tag separately, with TTL)
    if (kv) {
      await Promise.all(
        tagList.map((tag) =>
          kv.put(`tag:${tag}`, now, { expirationTtl: KV_TTL_SECONDS }).catch((err) => {
            console.error(`[cache] KV tag put failed for ${tag}:`, (err as Error).message);
          }),
        ),
      );
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
