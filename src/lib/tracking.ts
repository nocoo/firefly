// ---------------------------------------------------------------------------
// Analytics tracking — called from proxy for public page views
// ---------------------------------------------------------------------------

import { createDb, type Db } from "@/lib/db";
import { createCache } from "@/lib/cache";
import { hashIp } from "@/lib/hash";
import { detectBot, parseDevice } from "@/models/analytics";
import { recordPageView } from "@/data/analytics";

// ---------------------------------------------------------------------------
// post_id resolution: path → slug → posts.id
// ---------------------------------------------------------------------------

/** Matches article paths: /{year}/{month}/{slug} */
const ARTICLE_PATH_RE = /^\/(\d{4})\/(\d{2})\/([^/]+)\/?$/;

/** Process-level slug→postId cache, 5-min TTL (matches redirect cache) */
const slugCache = createCache<Map<string, string | null>>(5 * 60 * 1000);

/** @internal — exposed for test isolation only */
export function _resetSlugCache(): void {
  slugCache.invalidate();
}

/**
 * Extract slug from an article path and resolve the corresponding post ID.
 * Returns null for non-article paths or if the post is not found.
 * Never throws — failures degrade gracefully to null.
 */
export async function resolvePostId(
  db: Db,
  path: string,
): Promise<string | null> {
  const match = path.match(ARTICLE_PATH_RE);
  if (!match) return null;

  const slug = match[3];

  // Check cache
  let map = slugCache.get();
  if (map?.has(slug)) return map.get(slug) ?? null;

  // Query DB
  try {
    const row = await db.firstOrNull<{ id: string }>(
      "SELECT id FROM posts WHERE slug = ? AND status = 'published'",
      [slug],
    );
    const postId = row?.id ?? null;

    // Write to cache (create map if expired)
    if (!map) {
      map = new Map();
      slugCache.set(map);
    }
    map.set(slug, postId);

    return postId;
  } catch {
    // DB failure — degrade to null, don't block tracking
    return null;
  }
}

export interface TrackPageViewInput {
  path: string;
  userAgent: string | null;
  ip: string | null;
  referrer: string | null;
  country: string | null;
  city: string | null;
}

/**
 * Track a page view asynchronously. Fire-and-forget — errors are logged
 * but never thrown to avoid blocking the response.
 */
// Lazily-initialised singleton Db. Avoids per-request createDb allocation
// when trackPageView fires on every public page view.
let _trackingDb: Db | null = null;
function getTrackingDb(): Db | null {
  if (_trackingDb) return _trackingDb;
  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SECRET;
  if (!workerUrl || !workerSecret) return null;
  _trackingDb = createDb(workerUrl, workerSecret);
  return _trackingDb;
}

/** @internal — exposed for test isolation only */
export function _resetTrackingDb(): void {
  _trackingDb = null;
}

export async function trackPageView(input: TrackPageViewInput): Promise<void> {
  try {
    const db = getTrackingDb();
    if (!db) return;

    const bot = detectBot(input.userAgent);
    const device = parseDevice(input.userAgent);
    const ipHash = input.ip ? await hashIp(input.ip) : null;
    const postId = await resolvePostId(db, input.path);

    await recordPageView(db, {
      path: input.path,
      postId,
      referrer: input.referrer,
      userAgent: input.userAgent,
      ipHash,
      country: input.country,
      city: input.city,
      deviceType: device.deviceType,
      browser: device.browser,
      os: device.os,
      isBot: bot.isBot,
      botName: bot.botName,
      botCategory: bot.botCategory,
    });
  } catch (err) {
    // Never let analytics tracking break the user experience
    console.error("Analytics tracking error:", err);
  }
}
