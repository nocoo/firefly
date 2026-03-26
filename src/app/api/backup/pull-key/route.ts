import { getDb, DbError } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { generatePullWebhookKey } from "@/models/backup.server";
import {
  getBackyPullKey,
  saveBackyPullKey,
  clearBackyPullKey,
} from "@/data/backup";

function handleError(error: unknown) {
  if (error instanceof DbError) {
    return errorResponse(error.message, error.status ?? 500);
  }
  console.error("Backup pull-key API error:", error);
  return errorResponse("Internal server error", 500);
}

// GET /api/backup/pull-key — get current pull webhook key
export async function GET() {
  try {
    const db = getDb();
    const key = await getBackyPullKey(db);

    if (!key) {
      return jsonResponse({ configured: false });
    }

    return jsonResponse({ configured: true, key });
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/backup/pull-key — generate or regenerate pull key
export async function POST() {
  try {
    const db = getDb();
    const key = generatePullWebhookKey();
    await saveBackyPullKey(db, key);

    return jsonResponse({ key });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE /api/backup/pull-key — revoke pull key
export async function DELETE() {
  try {
    const db = getDb();
    await clearBackyPullKey(db);
    return jsonResponse({ revoked: true });
  } catch (error) {
    return handleError(error);
  }
}
