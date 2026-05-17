// ---------------------------------------------------------------------------
// Analytics — Human Visitors detail
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { HumanDetailResponse } from "@/models/analytics-types";
import {
  TIME_WINDOW_WHERE,
  resolveTopPages,
  sourceCondition,
} from "./analytics-helpers";

export async function getHumanDetail(
  db: Db,
  days: number,
): Promise<HumanDetailResponse> {
  const human = sourceCondition("human");
  const [topPagesRaw, topReferrers, devices, browsers, os, countries, cities, recent24h] =
    await Promise.all([
      db.query<{ path: string; views: number }>(
        `SELECT path, COUNT(*) AS views
         FROM page_views
         WHERE ${TIME_WINDOW_WHERE} AND ${human}
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
         WHERE ${TIME_WINDOW_WHERE} AND ${human}
           AND referrer IS NOT NULL AND referrer != ''
         GROUP BY 1
         HAVING referrer != ''
         ORDER BY views DESC
         LIMIT 20`,
        [days],
      ),
      db.query<{ device_type: string; count: number }>(
        `SELECT COALESCE(device_type, 'unknown') AS device_type, COUNT(*) AS count
         FROM page_views
         WHERE ${TIME_WINDOW_WHERE} AND ${human}
         GROUP BY device_type
         ORDER BY count DESC`,
        [days],
      ),
      db.query<{ browser: string; count: number }>(
        `SELECT COALESCE(browser, 'Unknown') AS browser, COUNT(*) AS count
         FROM page_views
         WHERE ${TIME_WINDOW_WHERE} AND ${human}
         GROUP BY browser
         ORDER BY count DESC
         LIMIT 10`,
        [days],
      ),
      db.query<{ os: string; count: number }>(
        `SELECT COALESCE(os, 'Unknown') AS os, COUNT(*) AS count
         FROM page_views
         WHERE ${TIME_WINDOW_WHERE} AND ${human}
         GROUP BY os
         ORDER BY count DESC
         LIMIT 10`,
        [days],
      ),
      db.query<{ country: string; count: number }>(
        `SELECT COALESCE(country, 'Unknown') AS country, COUNT(*) AS count
         FROM page_views
         WHERE ${TIME_WINDOW_WHERE} AND ${human}
         GROUP BY country
         ORDER BY count DESC
         LIMIT 20`,
        [days],
      ),
      db.query<{ city: string; count: number }>(
        `SELECT city, COUNT(*) AS count
         FROM page_views
         WHERE ${TIME_WINDOW_WHERE} AND ${human}
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
