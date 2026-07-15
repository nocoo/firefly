import type { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api";
import { getDb, DbError } from "@/lib/db";
import {
  getAnalyticsOverview,
  getAnalyticsDailyTrend,
  getAnalyticsAggregates,
  computePeriodDates,
} from "@/data/analytics";
import type { AnalyticsSummaryResponse } from "@/models/analytics-types";

const MIN_DAYS = 1;
const MAX_DAYS = 365;
const DEFAULT_DAYS = 30;

/**
 * GET /api/analytics — Summary endpoint for the analytics dashboard.
 * Returns overview + daily trend + cross-source aggregates + period info.
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

    const [overview, daily, aggregates] = await Promise.all([
      getAnalyticsOverview(db, days),
      getAnalyticsDailyTrend(db, days),
      getAnalyticsAggregates(db, days),
    ]);

    const { startDate, endDate } = computePeriodDates(days);

    const response: AnalyticsSummaryResponse = {
      overview,
      daily,
      aggregates,
      period: { days, startDate, endDate },
    };

    return jsonResponse(response);
  } catch (err) {
    console.error("Analytics API error:", err);
    if (err instanceof DbError) {
      return errorResponse(err.message, err.status ?? 500);
    }
    return errorResponse("Failed to fetch analytics", 500);
  }
}
