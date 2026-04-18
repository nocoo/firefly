// ---------------------------------------------------------------------------
// Sliding-window IP rate limiter (in-memory, process-scoped)
// ---------------------------------------------------------------------------
//
// This rate limiter is intended for protecting public API endpoints from
// abuse. It maintains a per-key (typically client IP) ring of request
// timestamps and counts how many fall inside the active window.
//
// Notes & trade-offs:
// - In-memory: state is lost on restart and not shared across processes.
//   Suitable for single-instance deployments or as a first line of defense.
// - Cleanup runs opportunistically on every call. We also drop fully-expired
//   entries to prevent unbounded memory growth from one-shot visitors.

interface Bucket {
  // Timestamps (ms) of recent requests, oldest first.
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

// Bound how often we sweep the entire Map for fully-expired buckets.
// A periodic full sweep is cheaper than scanning on every request.
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now: number, windowMs: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    const cutoff = now - windowMs;
    while (bucket.timestamps.length > 0 && bucket.timestamps[0] <= cutoff) {
      bucket.timestamps.shift();
    }
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the oldest in-window request expires. */
  resetMs: number;
}

/**
 * Sliding-window rate limit check for a given key (typically client IP).
 *
 * Each call records an attempt (when allowed) and reports whether the request
 * fits inside the configured window. When `allowed` is false, the request was
 * NOT recorded — the caller should reject it.
 *
 * @param key      Identifier to throttle on (e.g. client IP).
 * @param limit    Maximum number of requests allowed inside the window.
 * @param windowMs Window length in milliseconds.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  sweep(now, windowMs);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  // Drop expired timestamps from the front of the ring.
  while (bucket.timestamps.length > 0 && bucket.timestamps[0] <= cutoff) {
    bucket.timestamps.shift();
  }

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    const resetMs = Math.max(0, oldest + windowMs - now);
    return { allowed: false, remaining: 0, resetMs };
  }

  bucket.timestamps.push(now);
  const remaining = limit - bucket.timestamps.length;
  // Reset is when the oldest timestamp leaves the window.
  const resetMs = bucket.timestamps[0] + windowMs - now;
  return { allowed: true, remaining, resetMs };
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** @internal — exposed for unit tests only */
export const _testHelpers = {
  reset(): void {
    buckets.clear();
    lastSweep = 0;
  },
  size(): number {
    return buckets.size;
  },
};
