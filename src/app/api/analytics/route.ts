import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api";
import { getDb } from "@/lib/db";
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

/**
 * GET /api/analytics — fetch analytics data for the dashboard.
 * Protected by middleware (requires admin auth).
 *
 * Query params:
 *   days=30 (default) — time range in days (1-365)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const days = Math.min(
      Math.max(parseInt(searchParams.get("days") ?? "30", 10) || 30, 1),
      365,
    );

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
    return errorResponse("Failed to fetch analytics", 500);
  }
}
