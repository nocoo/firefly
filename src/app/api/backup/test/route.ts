import { getDb, DbError } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { getBackyConfig } from "@/data/backup";

function handleError(error: unknown) {
  if (error instanceof DbError) {
    return errorResponse(error.message, error.status ?? 500);
  }
  console.error("Backup test API error:", error);
  return errorResponse("Internal server error", 500);
}

// POST /api/backup/test — test Backy connection (HEAD request to webhook URL)
export async function POST() {
  try {
    const db = getDb();
    const config = await getBackyConfig(db);

    if (!config) {
      return errorResponse("Backup not configured", 422);
    }

    const response = await fetch(config.webhookUrl, {
      method: "HEAD",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      return jsonResponse({ ok: true, status: response.status });
    }

    return jsonResponse(
      { ok: false, status: response.status, statusText: response.statusText },
      response.status,
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return errorResponse("Connection timed out", 504);
    }
    return handleError(error);
  }
}
