import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { reorderCategories } from "@/data/categories";

// PUT /api/categories/reorder
export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as { ids?: string[] };

    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return errorResponse("ids must be a non-empty array");
    }

    const db = getDb();
    await reorderCategories(db, body.ids);

    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
