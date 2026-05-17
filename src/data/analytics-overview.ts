// ---------------------------------------------------------------------------
// Analytics — top-level summary queries (overview, daily trend, aggregates)
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type {
  AnalyticsOverview,
  AnalyticsDailyTrend,
  AnalyticsAggregates,
} from "@/models/analytics-types";
import {
  TIME_WINDOW_WHERE,
  PREV_WINDOW_WHERE,
  computePeriodDates,
  fillDailyGaps,
  type DailyRow,
} from "./analytics-helpers";

// Aggregated counts by source over a time window (used for both current/previous periods)
interface SourceCounts {
  total: number;
  human: number;
  search: number;
  ai: number;
  other_bot: number;
}

const SOURCE_COUNTS_SELECT = `
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS human,
    SUM(CASE WHEN is_bot = 1 AND bot_category = 'search' THEN 1 ELSE 0 END) AS search,
    SUM(CASE WHEN is_bot = 1 AND bot_category = 'ai' THEN 1 ELSE 0 END) AS ai,
    SUM(CASE WHEN is_bot = 1 AND COALESCE(bot_category, 'other') NOT IN ('search', 'ai') THEN 1 ELSE 0 END) AS other_bot
  FROM page_views`;

function pct(curr: number, prev: number): number | "new" | null {
  if (prev === 0) return curr > 0 ? "new" : null;
  return Math.round(((curr - prev) / prev) * 100);
}

function normalizeCounts(row: SourceCounts | null) {
  return {
    total: row?.total ?? 0,
    human: row?.human ?? 0,
    search: row?.search ?? 0,
    ai: row?.ai ?? 0,
    otherBot: row?.other_bot ?? 0,
  };
}

export async function getAnalyticsOverview(
  db: Db,
  days: number,
): Promise<AnalyticsOverview> {
  const [current, previous, uniqueCurrent, uniquePrevious] = await Promise.all([
    db.firstOrNull<SourceCounts>(
      `${SOURCE_COUNTS_SELECT} WHERE ${TIME_WINDOW_WHERE}`,
      [days],
    ),
    db.firstOrNull<SourceCounts>(
      `${SOURCE_COUNTS_SELECT} WHERE ${PREV_WINDOW_WHERE}`,
      [days, days],
    ),
    db.firstOrNull<{ count: number }>(
      `SELECT COUNT(DISTINCT ip_hash) AS count
       FROM page_views
       WHERE ${TIME_WINDOW_WHERE} AND is_bot = 0 AND ip_hash IS NOT NULL`,
      [days],
    ),
    db.firstOrNull<{ count: number }>(
      `SELECT COUNT(DISTINCT ip_hash) AS count
       FROM page_views
       WHERE ${PREV_WINDOW_WHERE} AND is_bot = 0 AND ip_hash IS NOT NULL`,
      [days, days],
    ),
  ]);

  const c = normalizeCounts(current);
  const p = normalizeCounts(previous);
  const uv = {
    current: uniqueCurrent?.count ?? 0,
    previous: uniquePrevious?.count ?? 0,
  };

  return {
    total: c.total,
    human: c.human,
    search: c.search,
    ai: c.ai,
    otherBot: c.otherBot,
    uniqueVisitors: uv.current,
    totalDelta: pct(c.total, p.total),
    humanDelta: pct(c.human, p.human),
    searchDelta: pct(c.search, p.search),
    aiDelta: pct(c.ai, p.ai),
    otherBotDelta: pct(c.otherBot, p.otherBot),
    uniqueVisitorsDelta: pct(uv.current, uv.previous),
  };
}

export async function getAnalyticsDailyTrend(
  db: Db,
  days: number,
): Promise<AnalyticsDailyTrend[]> {
  const result = await db.query<{
    date: string;
    human: number;
    search: number;
    ai: number;
    other_bot: number;
  }>(
    `SELECT
       date(viewed_at, 'unixepoch') AS date,
       SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS human,
       SUM(CASE WHEN is_bot = 1 AND bot_category = 'search' THEN 1 ELSE 0 END) AS search,
       SUM(CASE WHEN is_bot = 1 AND bot_category = 'ai' THEN 1 ELSE 0 END) AS ai,
       SUM(CASE WHEN is_bot = 1 AND COALESCE(bot_category, 'other') NOT IN ('search', 'ai') THEN 1 ELSE 0 END) AS other_bot
     FROM page_views
     WHERE ${TIME_WINDOW_WHERE}
     GROUP BY date
     ORDER BY date ASC`,
    [days],
  );

  const { startDate, endDate } = computePeriodDates(days);
  const rows: DailyRow[] = result.results.map((r) => ({
    date: r.date,
    human: r.human,
    search: r.search,
    ai: r.ai,
    otherBot: r.other_bot,
  }));

  return fillDailyGaps(rows, startDate, endDate);
}

export async function getAnalyticsAggregates(
  db: Db,
  days: number,
): Promise<AnalyticsAggregates> {
  const [countries, platforms, browsers] = await Promise.all([
    db.query<{ country: string; count: number }>(
      `SELECT COALESCE(country, 'Unknown') AS country, COUNT(*) AS count
       FROM page_views
       WHERE ${TIME_WINDOW_WHERE}
       GROUP BY country
       ORDER BY count DESC
       LIMIT 20`,
      [days],
    ),
    db.query<{ os: string; count: number }>(
      `SELECT COALESCE(os, 'Unknown') AS os, COUNT(*) AS count
       FROM page_views
       WHERE ${TIME_WINDOW_WHERE} AND is_bot = 0
       GROUP BY os
       ORDER BY count DESC
       LIMIT 20`,
      [days],
    ),
    db.query<{ browser: string; count: number }>(
      `SELECT COALESCE(browser, 'Unknown') AS browser, COUNT(*) AS count
       FROM page_views
       WHERE ${TIME_WINDOW_WHERE} AND is_bot = 0
       GROUP BY browser
       ORDER BY count DESC
       LIMIT 20`,
      [days],
    ),
  ]);

  return {
    countries: countries.results,
    platforms: platforms.results,
    browsers: browsers.results,
  };
}
