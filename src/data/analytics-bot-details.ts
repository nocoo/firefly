// ---------------------------------------------------------------------------
// Analytics — bot detail (search engines + AI bots, share infrastructure)
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type {
  AiBotDetailResponse,
  SearchDetailResponse,
} from "@/models/analytics-types";
import {
  ARTICLE_PATH_RE,
  TIME_WINDOW_WHERE,
  computePeriodDates,
  fillDailyByBotGaps,
  formatPathAsTitle,
  lookupPostTitleBySlug,
  resolveTopPages,
  sourceCondition,
  type SourceType,
} from "./analytics-helpers";

interface BotDetailResult {
  bots: { botName: string; count: number }[];
  topPages: Awaited<ReturnType<typeof resolveTopPages>>;
  dailyByBot: { date: string; botName: string; count: number }[];
}

/**
 * Shared loader for "bot-style" source details (search, AI). Both fetch the
 * same three series: bots breakdown, top pages, daily-by-bot trend.
 */
async function loadBotDetail(
  db: Db,
  days: number,
  source: SourceType,
): Promise<BotDetailResult> {
  const cond = sourceCondition(source);
  const { startDate, endDate } = computePeriodDates(days);

  const [bots, topPagesRaw, dailyByBotRaw] = await Promise.all([
    db.query<{ bot_name: string; count: number }>(
      `SELECT COALESCE(bot_name, 'Unknown') AS bot_name, COUNT(*) AS count
       FROM page_views
       WHERE ${TIME_WINDOW_WHERE} AND ${cond}
       GROUP BY bot_name
       ORDER BY count DESC
       LIMIT 20`,
      [days],
    ),
    db.query<{ path: string; views: number }>(
      `SELECT path, COUNT(*) AS views
       FROM page_views
       WHERE ${TIME_WINDOW_WHERE} AND ${cond}
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
       WHERE ${TIME_WINDOW_WHERE} AND ${cond}
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
    bots: bots.results.map((r) => ({ botName: r.bot_name, count: r.count })),
    topPages,
    dailyByBot,
  };
}

export async function getSearchDetail(
  db: Db,
  days: number,
): Promise<SearchDetailResponse> {
  const cond = sourceCondition("search");
  const [base, crawlerVsPageRaw] = await Promise.all([
    loadBotDetail(db, days, "search"),
    db.query<{ bot_name: string; path: string; count: number }>(
      `SELECT COALESCE(bot_name, 'Unknown') AS bot_name, path, COUNT(*) AS count
       FROM page_views
       WHERE ${TIME_WINDOW_WHERE} AND ${cond}
       GROUP BY bot_name, path
       ORDER BY count DESC
       LIMIT 50`,
      [days],
    ),
  ]);

  // Resolve titles for crawlerVsPage (article paths use post title fallback)
  const crawlerVsPage = await Promise.all(
    crawlerVsPageRaw.results.map(async (r) => {
      const match = r.path.match(ARTICLE_PATH_RE);
      let title = formatPathAsTitle(r.path);
      if (match) {
        const postTitle = await lookupPostTitleBySlug(db, match[3]);
        if (postTitle) title = postTitle;
      }
      return {
        botName: r.bot_name,
        path: r.path,
        title,
        count: r.count,
      };
    }),
  );

  return { type: "search", ...base, crawlerVsPage };
}

export async function getAiBotDetail(
  db: Db,
  days: number,
): Promise<AiBotDetailResponse> {
  const base = await loadBotDetail(db, days, "ai");
  return { type: "ai", ...base };
}
