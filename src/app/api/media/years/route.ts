import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { listMediaYears } from "@/data/entities/media";

/**
 * GET /api/media/years — return distinct years with attachment counts.
 *
 * Response: { years: [{ year: 2009, count: 268 }, ...] }
 */
export async function GET() {
  try {
    const db = getDb();
    const years = await listMediaYears(db);
    return jsonResponse({ years });
  } catch (err) {
    console.error("List media years error:", err);
    return errorResponse("Failed to list media years", 500);
  }
}
