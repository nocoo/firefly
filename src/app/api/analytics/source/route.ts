import type { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api";
import { getDb, DbError } from "@/lib/db";
import {
  getHumanDetail,
  getSearchDetail,
  getAiBotDetail,
  getOtherBotDetail,
} from "@/data/analytics";

const MIN_DAYS = 1;
const MAX_DAYS = 365;
const DEFAULT_DAYS = 30;
const VALID_TYPES = ["human", "search", "ai", "other"] as const;
type SourceType = (typeof VALID_TYPES)[number];

/**
 * GET /api/analytics/source — Source detail endpoint.
 * Returns per-source detail data for the analytics dashboard tabs.
 * Protected by proxy (requires admin auth).
 *
 * Query params:
 *   type=human|search|ai|other (required)
 *   days=30 (default) — time range in days (1-365)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type") as SourceType | null;

    if (!type || !VALID_TYPES.includes(type)) {
      return errorResponse(
        `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`,
        400,
      );
    }

    const raw = parseInt(searchParams.get("days") ?? "", 10);
    const days = Number.isNaN(raw)
      ? DEFAULT_DAYS
      : Math.min(Math.max(raw, MIN_DAYS), MAX_DAYS);

    const db = getDb();

    const detailFn = {
      human: getHumanDetail,
      search: getSearchDetail,
      ai: getAiBotDetail,
      other: getOtherBotDetail,
    }[type];

    const detail = await detailFn(db, days);
    return jsonResponse(detail);
  } catch (err) {
    console.error("Analytics source API error:", err);
    if (err instanceof DbError) {
      return errorResponse(err.message, err.status ?? 500);
    }
    return errorResponse("Failed to fetch source detail", 500);
  }
}
