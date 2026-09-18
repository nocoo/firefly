import { revalidateTag, unstable_cache } from "next/cache";

const TAG = "public-content";
const REVALIDATE_SECONDS = 3600;
const NEGATIVE_TTL_MS = 30_000;
const MAX_NEGATIVE_ENTRIES = 256;
const MAX_CONTENT_KEYS = 2048;
const stateKey = Symbol.for("firefly.public-content-cache.v1");
const absent = new Error("Public content not found");

interface CacheState {
  epoch: string;
  pending: Map<string, Promise<unknown>>;
  missing: Map<string, number>;
  keys: Set<string>;
}

function state(): CacheState {
  const runtime = globalThis as typeof globalThis & { [stateKey]?: CacheState };
  runtime[stateKey] ??= {
    epoch: crypto.randomUUID(),
    pending: new Map(),
    missing: new Map(),
    keys: new Set(),
  };
  return runtime[stateKey];
}

/** Public data only. Auth, private posts and health probes must bypass this. */
export function readPublicContent<T>(
  key: readonly unknown[],
  load: () => Promise<T>,
): Promise<T> {
  const cache = state();
  const epoch = cache.epoch;
  const keyParts = ["firefly-public-v1", process.env.WORKER_URL ?? "local", epoch, JSON.stringify(key)];
  const id = JSON.stringify(keyParts);
  const missingUntil = cache.missing.get(id);
  if (missingUntil !== undefined) {
    if (missingUntil > Date.now()) return Promise.resolve(null as T);
    cache.missing.delete(id);
  }
  const pending = cache.pending.get(id);
  if (pending) return pending as Promise<T>;
  if (!cache.keys.has(id) && cache.keys.size >= MAX_CONTENT_KEYS) return load();

  const result = unstable_cache(async () => {
    const value = await load();
    // Keep arbitrary scanner URLs out of Next's persistent cache.
    if (value === null) throw absent;
    if (cache.epoch === epoch) cache.keys.add(id);
    return value;
  }, keyParts, { tags: [TAG], revalidate: REVALIDATE_SECONDS })()
    .catch((error: unknown) => {
      if (error !== absent) throw error;
      if (cache.epoch === epoch) {
        if (cache.missing.size >= MAX_NEGATIVE_ENTRIES) {
          const oldest = cache.missing.keys().next().value;
          if (oldest !== undefined) cache.missing.delete(oldest);
        }
        cache.missing.set(id, Date.now() + NEGATIVE_TTL_MS);
      }
      return null as T;
    })
    .finally(() => cache.pending.delete(id));
  cache.pending.set(id, result);
  return result;
}

/**
 * All copies of the Next server bundle share the generation in globalThis.
 * Changing the key also prevents an in-flight pre-write read repopulating the
 * current cache. A new process starts cold, including after a local restart.
 * ponytail: single-instance coordination; use a shared handler before scaling.
 */
export function invalidatePublicContent(): void {
  const cache = state();
  cache.epoch = crypto.randomUUID();
  cache.pending.clear();
  cache.missing.clear();
  cache.keys.clear();
  try {
    revalidateTag(TAG, { expire: 0 });
  } catch (error) {
    // The database write has committed. Never turn cache maintenance into a
    // failed save; the new generation already prevents stale data reuse here.
    console.error("Public content cache invalidation failed:", error);
  }
}
