import { getDb, DbError } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import type { BackyHistoryResponse } from "@/models/backup";
import { getBackyConfig } from "@/data/backup";

function handleError(error: unknown) {
  if (error instanceof DbError) {
    return errorResponse(error.message, error.status ?? 500);
  }
  console.error("Backup history API error:", error);
  return errorResponse("Internal server error", 500);
}

// GET /api/backup/history — fetch backup history from Backy
export async function GET() {
  try {
    const db = getDb();
    const config = await getBackyConfig(db);

    if (!config) {
      return errorResponse("Backup not configured", 422);
    }

    const res = await fetch(config.webhookUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return errorResponse(
        `Failed to fetch history (${res.status})`,
        res.status >= 500 ? 502 : res.status,
      );
    }

    const history = (await res.json()) as BackyHistoryResponse;
    return jsonResponse(history);
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return errorResponse("History fetch timed out", 504);
    }
    return handleError(error);
  }
}
