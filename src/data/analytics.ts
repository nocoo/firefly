// ---------------------------------------------------------------------------
// Analytics data layer — page view tracking and stats queries
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { SiteDailyStat } from "@/models/types";
import { ulid } from "ulid";

// ---------------------------------------------------------------------------
// Record a page view
// ---------------------------------------------------------------------------

export interface RecordPageViewInput {
  path: string;
  postId?: string | null | undefined;
  referrer?: string | null | undefined;
  userAgent?: string | null | undefined;
  ipHash?: string | null | undefined;
  country?: string | null | undefined;
  city?: string | null | undefined;
  deviceType?: string | null | undefined;
  browser?: string | null | undefined;
  os?: string | null | undefined;
  isBot?: boolean | undefined;
  botName?: string | null | undefined;
  botCategory?: string | null | undefined;
  sessionId?: string | null | undefined;
}

export async function recordPageView(
  db: Db,
  input: RecordPageViewInput,
): Promise<void> {
  const id = ulid();
  await db.execute(
    `INSERT INTO page_views (id, post_id, path, referrer, user_agent, ip_hash, country, city, device_type, browser, os, is_bot, bot_name, bot_category, session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.postId ?? null,
      input.path,
      input.referrer ?? null,
      input.userAgent ?? null,
      input.ipHash ?? null,
      input.country ?? null,
      input.city ?? null,
      input.deviceType ?? null,
      input.browser ?? null,
      input.os ?? null,
      input.isBot ? 1 : 0,
      input.botName ?? null,
      input.botCategory ?? null,
      input.sessionId ?? null,
    ],
  );
}

// ---------------------------------------------------------------------------
// Site-level daily stats
// ---------------------------------------------------------------------------

export async function getSiteDailyStats(
  db: Db,
  days: number = 30,
): Promise<SiteDailyStat[]> {
  const result = await db.query<SiteDailyStat>(
    `SELECT * FROM site_daily_stats
     WHERE date >= date('now', '-' || ? || ' days')
     ORDER BY date ASC`,
    [days],
  );
  return result.results;
}

// ---------------------------------------------------------------------------
// Overview stats (aggregated totals)
// ---------------------------------------------------------------------------

export interface OverviewStats {
  totalViews: number;
  totalUniqueVisitors: number;
  totalBotViews: number;
  totalAiBotViews: number;
  totalSearchBotViews: number;
}

export async function getOverviewStats(
  db: Db,
  days: number = 30,
): Promise<OverviewStats> {
  const row = await db.firstOrNull<{
    total_views: number;
    unique_visitors: number;
    bot_views: number;
    ai_bot_views: number;
    search_bot_views: number;
  }>(
    `SELECT
       COALESCE(SUM(total_views), 0) AS total_views,
       COALESCE(SUM(unique_visitors), 0) AS unique_visitors,
       COALESCE(SUM(total_bot_views), 0) AS bot_views,
       COALESCE(SUM(ai_bot_views), 0) AS ai_bot_views,
       COALESCE(SUM(search_bot_views), 0) AS search_bot_views
     FROM site_daily_stats
     WHERE date >= date('now', '-' || ? || ' days')`,
    [days],
  );

  return {
    totalViews: row?.total_views ?? 0,
    totalUniqueVisitors: row?.unique_visitors ?? 0,
    totalBotViews: row?.bot_views ?? 0,
    totalAiBotViews: row?.ai_bot_views ?? 0,
    totalSearchBotViews: row?.search_bot_views ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Top posts by views
// ---------------------------------------------------------------------------

export interface TopPost {
  postId: string;
  title: string;
  slug: string;
  views: number;
}

export async function getTopPosts(
  db: Db,
  days: number = 30,
  limit: number = 10,
): Promise<TopPost[]> {
  const result = await db.query<{
    post_id: string;
    title: string;
    slug: string;
    views: number;
  }>(
    `SELECT ds.post_id, p.title, p.slug, SUM(ds.views) AS views
     FROM daily_stats ds
     JOIN posts p ON p.id = ds.post_id
     WHERE ds.date >= date('now', '-' || ? || ' days')
     GROUP BY ds.post_id
     ORDER BY views DESC
     LIMIT ?`,
    [days, limit],
  );
  return result.results.map((r) => ({
    postId: r.post_id,
    title: r.title,
    slug: r.slug,
    views: r.views,
  }));
}

// ---------------------------------------------------------------------------
// Recent page views count (for real-time-ish display)
// ---------------------------------------------------------------------------

export async function getRecentViewCount(
  db: Db,
  hours: number = 24,
): Promise<number> {
  const since = Math.floor(Date.now() / 1000) - hours * 3600;
  const row = await db.firstOrNull<{ count: number }>(
    `SELECT COUNT(*) AS count FROM page_views
     WHERE viewed_at >= ? AND is_bot = 0`,
    [since],
  );
  return row?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Top referrers
// ---------------------------------------------------------------------------

export interface TopReferrer {
  referrer: string;
  views: number;
}

export async function getTopReferrers(
  db: Db,
  days: number = 30,
  limit: number = 10,
): Promise<TopReferrer[]> {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const result = await db.query<{ referrer: string; views: number }>(
    `SELECT referrer, COUNT(*) AS views
     FROM page_views
     WHERE viewed_at >= ? AND is_bot = 0 AND referrer IS NOT NULL AND referrer != ''
     GROUP BY referrer
     ORDER BY views DESC
     LIMIT ?`,
    [since, limit],
  );
  return result.results;
}

// ---------------------------------------------------------------------------
// Device breakdown
// ---------------------------------------------------------------------------

export interface DeviceBreakdown {
  deviceType: string;
  count: number;
}

export async function getDeviceBreakdown(
  db: Db,
  days: number = 30,
): Promise<DeviceBreakdown[]> {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const result = await db.query<{ device_type: string; count: number }>(
    `SELECT COALESCE(device_type, 'unknown') AS device_type, COUNT(*) AS count
     FROM page_views
     WHERE viewed_at >= ? AND is_bot = 0
     GROUP BY device_type
     ORDER BY count DESC`,
    [since],
  );
  return result.results.map((r) => ({
    deviceType: r.device_type,
    count: r.count,
  }));
}

// ---------------------------------------------------------------------------
// Browser breakdown
// ---------------------------------------------------------------------------

export interface BrowserBreakdown {
  browser: string;
  count: number;
}

export async function getBrowserBreakdown(
  db: Db,
  days: number = 30,
  limit: number = 10,
): Promise<BrowserBreakdown[]> {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const result = await db.query<{ browser: string; count: number }>(
    `SELECT COALESCE(browser, 'Unknown') AS browser, COUNT(*) AS count
     FROM page_views
     WHERE viewed_at >= ? AND is_bot = 0
     GROUP BY browser
     ORDER BY count DESC
     LIMIT ?`,
    [since, limit],
  );
  return result.results;
}

// ---------------------------------------------------------------------------
// Bot breakdown
// ---------------------------------------------------------------------------

export interface BotBreakdown {
  botName: string;
  botCategory: string;
  count: number;
}

export async function getBotBreakdown(
  db: Db,
  days: number = 30,
  limit: number = 20,
): Promise<BotBreakdown[]> {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const result = await db.query<{
    bot_name: string;
    bot_category: string;
    count: number;
  }>(
    `SELECT COALESCE(bot_name, 'Unknown') AS bot_name,
            COALESCE(bot_category, 'other') AS bot_category,
            COUNT(*) AS count
     FROM page_views
     WHERE viewed_at >= ? AND is_bot = 1
     GROUP BY bot_name, bot_category
     ORDER BY count DESC
     LIMIT ?`,
    [since, limit],
  );
  return result.results.map((r) => ({
    botName: r.bot_name,
    botCategory: r.bot_category,
    count: r.count,
  }));
}
