import { NextRequest } from "next/server";
import { getDb, DbError } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { maskApiKey, validateBackyConfig } from "@/models/backup";
import type { BackyConfig } from "@/models/backup";
import { getBackyConfig, saveBackyConfig, clearBackyConfig } from "@/data/backup";

function handleError(error: unknown) {
  if (error instanceof DbError) {
    return errorResponse(error.message, error.status ?? 500);
  }
  console.error("Backup API error:", error);
  return errorResponse("Internal server error", 500);
}

// GET /api/backup — get push configuration (URL + masked key)
export async function GET() {
  try {
    const db = getDb();
    const config = await getBackyConfig(db);

    if (!config) {
      return jsonResponse({ configured: false });
    }

    return jsonResponse({
      configured: true,
      webhookUrl: config.webhookUrl,
      apiKey: maskApiKey(config.apiKey),
    });
  } catch (error) {
    return handleError(error);
  }
}

// PUT /api/backup — save push configuration
export async function PUT(request: NextRequest) {
  try {
    let body: Partial<BackyConfig>;
    try {
      body = (await request.json()) as Partial<BackyConfig>;
    } catch {
      return errorResponse("Invalid JSON body");
    }

    const db = getDb();
    const existing = await getBackyConfig(db);
    const isUpdate = !!existing;

    // When updating, apiKey can be omitted to keep the existing one
    const validation = validateBackyConfig(body, !isUpdate);
    if (!validation.valid) {
      return errorResponse(validation.error);
    }

    const apiKey = body.apiKey?.trim()
      ? (body.apiKey as string)
      : existing?.apiKey;

    if (!apiKey) {
      return errorResponse("API Key is required");
    }

    await saveBackyConfig(db, {
      webhookUrl: body.webhookUrl as string,
      apiKey,
    });

    return jsonResponse({ saved: true });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE /api/backup — clear push configuration
export async function DELETE() {
  try {
    const db = getDb();
    await clearBackyConfig(db);
    return jsonResponse({ cleared: true });
  } catch (error) {
    return handleError(error);
  }
}
