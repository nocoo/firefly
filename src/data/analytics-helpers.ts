// ---------------------------------------------------------------------------
// Analytics shared helpers — time windows, source conditions, gap-fill,
// path/title resolution, period computation.
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { TopPageItem } from "@/models/analytics-types";

/** Standard time window: complete UTC natural days, excludes today */
export const TIME_WINDOW_WHERE =
  "date(viewed_at, 'unixepoch') BETWEEN date('now', '-' || ? || ' days') AND date('now', '-1 day')";

/** Previous period window (shifted back by the same number of days) */
export const PREV_WINDOW_WHERE =
  "date(viewed_at, 'unixepoch') BETWEEN date('now', '-' || (2 * ?) || ' days') AND date('now', '-' || (? + 1) || ' days')";

export type SourceType = "human" | "search" | "ai" | "other";

/** Returns the SQL WHERE condition fragment for a given source type */
export function sourceCondition(type: SourceType): string {
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

  const lookup = new Map(rows.map((r) => [`${r.date}|${r.botName}`, r.count]));
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
export const ARTICLE_PATH_RE = /^\/(\d{4})\/(\d{2})\/([^/]+)\/?$/;

/** Look up published post title by slug; returns null on miss or DB failure. */
export async function lookupPostTitleBySlug(
  db: Db,
  slug: string,
): Promise<string | null> {
  try {
    const post = await db.firstOrNull<{ title: string }>(
      "SELECT title FROM posts WHERE slug = ? AND status = 'published'",
      [slug],
    );
    return post?.title ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve top pages with titles. For article paths, look up post title from DB.
 * For non-article paths, use formatPathAsTitle as fallback.
 */
export async function resolveTopPages(
  db: Db,
  rows: { path: string; views: number }[],
): Promise<TopPageItem[]> {
  return Promise.all(
    rows.map(async (row) => {
      const match = row.path.match(ARTICLE_PATH_RE);
      if (match) {
        const title = await lookupPostTitleBySlug(db, match[3]);
        if (title) {
          return { path: row.path, title, isPost: true, views: row.views };
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
