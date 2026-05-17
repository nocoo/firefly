// ---------------------------------------------------------------------------
// Analytics — Other Bots detail (social, monitor, unknown)
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { OtherBotDetailResponse } from "@/models/analytics-types";
import { TIME_WINDOW_WHERE, sourceCondition } from "./analytics-helpers";

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
