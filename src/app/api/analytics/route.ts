import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api";
import { getDb, DbError } from "@/lib/db";
import {
  getSiteDailyStats,
  getOverviewStats,
  getTopPosts,
  getRecentViewCount,
  getTopReferrers,
  getDeviceBreakdown,
  getBrowserBreakdown,
  getBotBreakdown,
} from "@/data/analytics";

const MIN_DAYS = 1;
const MAX_DAYS = 365;
const DEFAULT_DAYS = 30;

/**
 * GET /api/analytics — fetch analytics data for the dashboard.
 * Protected by proxy (requires admin auth).
 *
 * Query params:
 *   days=30 (default) — time range in days (1-365)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const raw = parseInt(searchParams.get("days") ?? "", 10);
    const days = Number.isNaN(raw)
      ? DEFAULT_DAYS
      : Math.min(Math.max(raw, MIN_DAYS), MAX_DAYS);

    const db = getDb();

    const [
      overview,
      dailyStats,
      topPosts,
      recentViews,
      topReferrers,
      devices,
      browsers,
      bots,
    ] = await Promise.all([
      getOverviewStats(db, days),
      getSiteDailyStats(db, days),
      getTopPosts(db, days),
      getRecentViewCount(db, 24),
      getTopReferrers(db, days),
      getDeviceBreakdown(db, days),
      getBrowserBreakdown(db, days),
      getBotBreakdown(db, days),
    ]);

    return jsonResponse({
      overview,
      dailyStats,
      topPosts,
      recentViews,
      topReferrers,
      devices,
      browsers,
      bots,
      period: { days },
    });
  } catch (err) {
    console.error("Analytics API error:", err);
    if (err instanceof DbError) {
      return errorResponse(err.message, err.status ?? 500);
    }
    return errorResponse("Failed to fetch analytics", 500);
  }
}
