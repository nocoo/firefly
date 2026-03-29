// ---------------------------------------------------------------------------
// Analytics data layer — page view tracking and stats queries
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type {
  AnalyticsOverview,
  AnalyticsDailyTrend,
  AnalyticsAggregates,
  TopPageItem,
  HumanDetailResponse,
  SearchDetailResponse,
  AiBotDetailResponse,
  OtherBotDetailResponse,
} from "@/models/analytics-types";
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

  // Increment posts.view_count for human visitors (cache-type field, eventual consistency)
  // UPDATE failure does not affect the page_view INSERT above.
  if (input.postId && !input.isBot) {
    await db.execute(
      "UPDATE posts SET view_count = view_count + 1 WHERE id = ?",
      [input.postId],
    ).catch(() => {
      // Silently ignore — view_count is a denormalized cache field
    });
  }
}

// ===========================================================================
// Four-source analytics — summary & source detail query functions
// ===========================================================================

// ---------------------------------------------------------------------------
// SQL WHERE clause for standard time window (complete UTC natural days, excludes today)
// ---------------------------------------------------------------------------

/** Standard time window: complete UTC natural days, excludes today */
const TIME_WINDOW_WHERE =
  "date(viewed_at, 'unixepoch') BETWEEN date('now', '-' || ? || ' days') AND date('now', '-1 day')";

/** Previous period window (shifted back by the same number of days) */
const PREV_WINDOW_WHERE =
  "date(viewed_at, 'unixepoch') BETWEEN date('now', '-' || (2 * ?) || ' days') AND date('now', '-' || (? + 1) || ' days')";

// ---------------------------------------------------------------------------
// Source SQL conditions
// ---------------------------------------------------------------------------

type SourceType = "human" | "search" | "ai" | "other";

/** Returns the SQL WHERE condition fragment for a given source type */
function sourceCondition(type: SourceType): string {
  switch (type) {
    case "human":
      return "is_bot = 0";
    case "search":
      return "is_bot = 1 AND bot_category = 'search'";
    case "ai":
      return "is_bot = 1 AND bot_category = 'ai'";
    case "other":
      return "is_bot = 1 AND COALESCE(bot_category, 'other') NOT IN ('search', 'ai')";
  }
}

// ---------------------------------------------------------------------------
// Helpers: zero-fill and path-to-title
// ---------------------------------------------------------------------------

export interface DailyRow {
  date: string;
  human: number;
  search: number;
  ai: number;
  otherBot: number;
}

/**
 * Fill gaps in daily trend data so every date in the range has a row.
 * SQL GROUP BY only returns dates with data — this fills missing dates with zeros.
 */
export function fillDailyGaps(
  rows: DailyRow[],
  startDate: string,
  endDate: string,
): DailyRow[] {
  const map = new Map(rows.map((r) => [r.date, r]));
  const result: DailyRow[] = [];
  for (
    let d = new Date(startDate + "T00:00:00Z");
    d <= new Date(endDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const key = d.toISOString().slice(0, 10);
    result.push(
      map.get(key) ?? { date: key, human: 0, search: 0, ai: 0, otherBot: 0 },
    );
  }
  return result;
}

export interface DailyByBotRow {
  date: string;
  botName: string;
  count: number;
}

/**
 * Fill gaps in daily-by-bot data using bot × date cartesian product.
 * Ensures every bot has a continuous data series across all dates.
 */
export function fillDailyByBotGaps(
  rows: DailyByBotRow[],
  startDate: string,
  endDate: string,
): DailyByBotRow[] {
  const botNames = [...new Set(rows.map((r) => r.botName))];
  if (botNames.length === 0) return [];

  const lookup = new Map(
    rows.map((r) => [`${r.date}|${r.botName}`, r.count]),
  );
  const result: DailyByBotRow[] = [];
  for (
    let d = new Date(startDate + "T00:00:00Z");
    d <= new Date(endDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const date = d.toISOString().slice(0, 10);
    for (const botName of botNames) {
      result.push({
        date,
        botName,
        count: lookup.get(`${date}|${botName}`) ?? 0,
      });
    }
  }
  return result;
}

/**
 * Format a URL path as a human-readable title (fallback when post title unavailable).
 * e.g. "/" → "Homepage", "/category/tech" → "category / tech"
 */
export function formatPathAsTitle(path: string): string {
  if (path === "/") return "Homepage";
  return path
    .replace(/^\//, "")
    .replace(/\/$/, "")
    .replace(/\//g, " / ");
}

/** Article path regex: /{year}/{month}/{slug} */
const ARTICLE_PATH_RE = /^\/(\d{4})\/(\d{2})\/([^/]+)\/?$/;

/**
 * Resolve top pages with titles. For article paths, look up post title from DB.
 * For non-article paths, use formatPathAsTitle as fallback.
 */
async function resolveTopPages(
  db: Db,
  rows: { path: string; views: number }[],
): Promise<TopPageItem[]> {
  return Promise.all(
    rows.map(async (row) => {
      const match = row.path.match(ARTICLE_PATH_RE);
      if (match) {
        const slug = match[3];
        try {
          const post = await db.firstOrNull<{ title: string }>(
            "SELECT title FROM posts WHERE slug = ? AND status = 'published'",
            [slug],
          );
          if (post) {
            return {
              path: row.path,
              title: post.title,
              isPost: true,
              views: row.views,
            };
          }
        } catch {
          // Degrade to path-based title on DB failure
        }
      }
      return {
        path: row.path,
        title: formatPathAsTitle(row.path),
        isPost: false,
        views: row.views,
      };
    }),
  );
}

/**
 * Compute the period start and end dates (complete UTC natural days, excludes today).
 */
export function computePeriodDates(days: number): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  );
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days),
  );
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Summary: Overview (current + previous period for delta calculation)
// ---------------------------------------------------------------------------

export async function getAnalyticsOverview(
  db: Db,
  days: number,
): Promise<AnalyticsOverview> {
  const [current, previous, uniqueCurrent, uniquePrevious] = await Promise.all([
    db.firstOrNull<{
      total: number;
      human: number;
      search: number;
      ai: number;
      other_bot: number;
    }>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS human,
         SUM(CASE WHEN is_bot = 1 AND bot_category = 'search' THEN 1 ELSE 0 END) AS search,
         SUM(CASE WHEN is_bot = 1 AND bot_category = 'ai' THEN 1 ELSE 0 END) AS ai,
         SUM(CASE WHEN is_bot = 1 AND COALESCE(bot_category, 'other') NOT IN ('search', 'ai') THEN 1 ELSE 0 END) AS other_bot
       FROM page_views
       WHERE ${TIME_WINDOW_WHERE}`,
      [days],
    ),
    db.firstOrNull<{
      total: number;
      human: number;
      search: number;
      ai: number;
      other_bot: number;
    }>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS human,
         SUM(CASE WHEN is_bot = 1 AND bot_category = 'search' THEN 1 ELSE 0 END) AS search,
         SUM(CASE WHEN is_bot = 1 AND bot_category = 'ai' THEN 1 ELSE 0 END) AS ai,
         SUM(CASE WHEN is_bot = 1 AND COALESCE(bot_category, 'other') NOT IN ('search', 'ai') THEN 1 ELSE 0 END) AS other_bot
       FROM page_views
       WHERE ${PREV_WINDOW_WHERE}`,
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

  function delta(curr: number, prev: number): number | "new" | null {
    if (prev === 0) return curr > 0 ? "new" : null;
    return Math.round(((curr - prev) / prev) * 100);
  }

  const c = {
    total: current?.total ?? 0,
    human: current?.human ?? 0,
    search: current?.search ?? 0,
    ai: current?.ai ?? 0,
    otherBot: current?.other_bot ?? 0,
  };
  const p = {
    total: previous?.total ?? 0,
    human: previous?.human ?? 0,
    search: previous?.search ?? 0,
    ai: previous?.ai ?? 0,
    otherBot: previous?.other_bot ?? 0,
  };

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
    totalDelta: delta(c.total, p.total),
    humanDelta: delta(c.human, p.human),
    searchDelta: delta(c.search, p.search),
    aiDelta: delta(c.ai, p.ai),
    otherBotDelta: delta(c.otherBot, p.otherBot),
    uniqueVisitorsDelta: delta(uv.current, uv.previous),
  };
}

// ---------------------------------------------------------------------------
// Summary: Daily trend (4-source breakdown per day, zero-filled)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Summary: Cross-source aggregates (countries, platforms, browsers)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Source Detail: Human Visitors
// ---------------------------------------------------------------------------

export async function getHumanDetail(
  db: Db,
  days: number,
): Promise<HumanDetailResponse> {
  const [topPagesRaw, topReferrers, devices, browsers, os, countries, cities, recent24h] =
    await Promise.all([
      db.query<{ path: string; views: number }>(
        `SELECT path, COUNT(*) AS views
         FROM page_views
         WHERE ${TIME_WINDOW_WHERE} AND ${sourceCondition("human")}
         GROUP BY path
         ORDER BY views DESC
         LIMIT 20`,
        [days],
      ),
      db.query<{ referrer: string; views: number }>(
        `SELECT
           REPLACE(
             CASE
               WHEN INSTR(SUBSTR(referrer, INSTR(referrer, '://') + 3), '/') > 0
               THEN SUBSTR(referrer, INSTR(referrer, '://') + 3,
                           INSTR(SUBSTR(referrer, INSTR(referrer, '://') + 3), '/') - 1)
               ELSE SUBSTR(referrer, INSTR(referrer, '://') + 3)
             END,
             'www.', ''
           ) AS referrer,
           COUNT(*) AS views
         FROM page_views
         WHERE ${TIME_WINDOW_WHERE} AND ${sourceCondition("human")}
           AND referrer IS NOT NULL AND referrer != ''
         GROUP BY 1
         ORDER BY views DESC
         LIMIT 20`,
        [days],
      ),
      db.query<{ device_type: string; count: number }>(
        `SELECT COALESCE(device_type, 'unknown') AS device_type, COUNT(*) AS count
         FROM page_views
         WHERE ${TIME_WINDOW_WHERE} AND ${sourceCondition("human")}
         GROUP BY device_type
         ORDER BY count DESC`,
        [days],
      ),
      db.query<{ browser: string; count: number }>(
        `SELECT COALESCE(browser, 'Unknown') AS browser, COUNT(*) AS count
         FROM page_views
         WHERE ${TIME_WINDOW_WHERE} AND ${sourceCondition("human")}
         GROUP BY browser
         ORDER BY count DESC
         LIMIT 10`,
        [days],
      ),
      db.query<{ os: string; count: number }>(
        `SELECT COALESCE(os, 'Unknown') AS os, COUNT(*) AS count
         FROM page_views
         WHERE ${TIME_WINDOW_WHERE} AND ${sourceCondition("human")}
         GROUP BY os
         ORDER BY count DESC
         LIMIT 10`,
        [days],
      ),
      db.query<{ country: string; count: number }>(
        `SELECT COALESCE(country, 'Unknown') AS country, COUNT(*) AS count
         FROM page_views
         WHERE ${TIME_WINDOW_WHERE} AND ${sourceCondition("human")}
         GROUP BY country
         ORDER BY count DESC
         LIMIT 20`,
        [days],
      ),
      db.query<{ city: string; count: number }>(
        `SELECT city, COUNT(*) AS count
         FROM page_views
         WHERE ${TIME_WINDOW_WHERE} AND ${sourceCondition("human")}
           AND city IS NOT NULL AND city != ''
         GROUP BY city
         ORDER BY count DESC
         LIMIT 20`,
        [days],
      ),
      // Recent 24h uses rolling window (unique exception per §3.4)
      db.firstOrNull<{ count: number }>(
        `SELECT COUNT(*) AS count FROM page_views
         WHERE viewed_at >= unixepoch('now') - 86400 AND is_bot = 0`,
      ),
    ]);

  const topPages = await resolveTopPages(db, topPagesRaw.results);

  return {
    type: "human",
    topPages,
    topReferrers: topReferrers.results,
    devices: devices.results.map((r) => ({
      deviceType: r.device_type,
      count: r.count,
    })),
    browsers: browsers.results,
    os: os.results,
    countries: countries.results,
    cities: cities.results,
    recent24h: recent24h?.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Source Detail: Search Engine
// ---------------------------------------------------------------------------

export async function getSearchDetail(
  db: Db,
  days: number,
): Promise<SearchDetailResponse> {
  const { startDate, endDate } = computePeriodDates(days);

  const [bots, topPagesRaw, dailyByBotRaw, crawlerVsPageRaw] =
    await Promise.all([
      db.query<{ bot_name: string; count: number }>(
        `SELECT COALESCE(bot_name, 'Unknown') AS bot_name, COUNT(*) AS count
         FROM page_views
         WHERE ${TIME_WINDOW_WHERE} AND ${sourceCondition("search")}
         GROUP BY bot_name
         ORDER BY count DESC
         LIMIT 20`,
        [days],
      ),
      db.query<{ path: string; views: number }>(
        `SELECT path, COUNT(*) AS views
         FROM page_views
         WHERE ${TIME_WINDOW_WHERE} AND ${sourceCondition("search")}
         GROUP BY path
         ORDER BY views DESC
         LIMIT 20`,
        [days],
      ),
      db.query<{ date: string; bot_name: string; count: number }>(
        `SELECT date(viewed_at, 'unixepoch') AS date,
                COALESCE(bot_name, 'Unknown') AS bot_name,
                COUNT(*) AS count
         FROM page_views
         WHERE ${TIME_WINDOW_WHERE} AND ${sourceCondition("search")}
         GROUP BY date, bot_name
         ORDER BY date ASC`,
        [days],
      ),
      db.query<{
        bot_name: string;
        path: string;
        count: number;
      }>(
        `SELECT COALESCE(bot_name, 'Unknown') AS bot_name, path, COUNT(*) AS count
         FROM page_views
         WHERE ${TIME_WINDOW_WHERE} AND ${sourceCondition("search")}
         GROUP BY bot_name, path
         ORDER BY count DESC
         LIMIT 50`,
        [days],
      ),
    ]);

  const topPages = await resolveTopPages(db, topPagesRaw.results);
  const dailyByBot = fillDailyByBotGaps(
    dailyByBotRaw.results.map((r) => ({
      date: r.date,
      botName: r.bot_name,
      count: r.count,
    })),
    startDate,
    endDate,
  );

  // Resolve titles for crawlerVsPage
  const crawlerVsPage = await Promise.all(
    crawlerVsPageRaw.results.map(async (r) => {
      const match = r.path.match(ARTICLE_PATH_RE);
      let title = formatPathAsTitle(r.path);
      if (match) {
        try {
          const post = await db.firstOrNull<{ title: string }>(
            "SELECT title FROM posts WHERE slug = ? AND status = 'published'",
            [match[3]],
          );
          if (post) title = post.title;
        } catch {
          // Degrade to path-based title
        }
      }
      return {
        botName: r.bot_name,
        path: r.path,
        title,
        count: r.count,
      };
    }),
  );

  return {
    type: "search",
    bots: bots.results.map((r) => ({ botName: r.bot_name, count: r.count })),
    topPages,
    dailyByBot,
    crawlerVsPage,
  };
}

// ---------------------------------------------------------------------------
// Source Detail: AI Bot
// ---------------------------------------------------------------------------

export async function getAiBotDetail(
  db: Db,
  days: number,
): Promise<AiBotDetailResponse> {
  const { startDate, endDate } = computePeriodDates(days);

  const [bots, topPagesRaw, dailyByBotRaw] = await Promise.all([
    db.query<{ bot_name: string; count: number }>(
      `SELECT COALESCE(bot_name, 'Unknown') AS bot_name, COUNT(*) AS count
       FROM page_views
       WHERE ${TIME_WINDOW_WHERE} AND ${sourceCondition("ai")}
       GROUP BY bot_name
       ORDER BY count DESC
       LIMIT 20`,
      [days],
    ),
    db.query<{ path: string; views: number }>(
      `SELECT path, COUNT(*) AS views
       FROM page_views
       WHERE ${TIME_WINDOW_WHERE} AND ${sourceCondition("ai")}
       GROUP BY path
       ORDER BY views DESC
       LIMIT 20`,
      [days],
    ),
    db.query<{ date: string; bot_name: string; count: number }>(
      `SELECT date(viewed_at, 'unixepoch') AS date,
              COALESCE(bot_name, 'Unknown') AS bot_name,
              COUNT(*) AS count
       FROM page_views
       WHERE ${TIME_WINDOW_WHERE} AND ${sourceCondition("ai")}
       GROUP BY date, bot_name
       ORDER BY date ASC`,
      [days],
    ),
  ]);

  const topPages = await resolveTopPages(db, topPagesRaw.results);
  const dailyByBot = fillDailyByBotGaps(
    dailyByBotRaw.results.map((r) => ({
      date: r.date,
      botName: r.bot_name,
      count: r.count,
    })),
    startDate,
    endDate,
  );

  return {
    type: "ai",
    bots: bots.results.map((r) => ({ botName: r.bot_name, count: r.count })),
    topPages,
    dailyByBot,
  };
}

// ---------------------------------------------------------------------------
// Source Detail: Other Bots
// ---------------------------------------------------------------------------

export async function getOtherBotDetail(
  db: Db,
  days: number,
): Promise<OtherBotDetailResponse> {
  const otherCond = sourceCondition("other");

  const [byCategory, socialBots, monitorBots, unknownBots] = await Promise.all([
    db.query<{ category: string; count: number }>(
      `SELECT COALESCE(bot_category, 'other') AS category, COUNT(*) AS count
       FROM page_views
       WHERE ${TIME_WINDOW_WHERE} AND ${otherCond}
       GROUP BY category
       ORDER BY count DESC`,
      [days],
    ),
    db.query<{ bot_name: string; count: number }>(
      `SELECT COALESCE(bot_name, 'Unknown') AS bot_name, COUNT(*) AS count
       FROM page_views
       WHERE ${TIME_WINDOW_WHERE} AND is_bot = 1 AND bot_category = 'social'
       GROUP BY bot_name
       ORDER BY count DESC
       LIMIT 20`,
      [days],
    ),
    db.query<{ bot_name: string; count: number }>(
      `SELECT COALESCE(bot_name, 'Unknown') AS bot_name, COUNT(*) AS count
       FROM page_views
       WHERE ${TIME_WINDOW_WHERE} AND is_bot = 1 AND bot_category = 'monitor'
       GROUP BY bot_name
       ORDER BY count DESC
       LIMIT 20`,
      [days],
    ),
    db.query<{ bot_name: string; user_agent: string; count: number }>(
      `SELECT COALESCE(bot_name, 'Unknown') AS bot_name,
              COALESCE(user_agent, '') AS user_agent,
              COUNT(*) AS count
       FROM page_views
       WHERE ${TIME_WINDOW_WHERE} AND is_bot = 1
         AND (bot_category IS NULL OR bot_category = 'other')
       GROUP BY bot_name, user_agent
       ORDER BY count DESC
       LIMIT 20`,
      [days],
    ),
  ]);

  return {
    type: "other",
    byCategory: byCategory.results,
    socialBots: socialBots.results.map((r) => ({
      botName: r.bot_name,
      count: r.count,
    })),
    monitorBots: monitorBots.results.map((r) => ({
      botName: r.bot_name,
      count: r.count,
    })),
    unknownBots: unknownBots.results.map((r) => ({
      botName: r.bot_name,
      userAgent: r.user_agent,
      count: r.count,
    })),
  };
}
