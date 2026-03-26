import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { batchUpdatePosts, type BatchUpdateInput } from "@/data/posts";
import type { PostStatus } from "@/models/types";

const VALID_STATUSES = new Set<PostStatus>([
  "draft",
  "published",
  "private",
  "archived",
]);

// PATCH /api/admin/posts/batch — bulk update status and/or category
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const body = (await request.json()) as {
      ids?: string[];
      updates?: BatchUpdateInput;
    };

    const { ids, updates } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return errorResponse("ids must be a non-empty array", 400);
    }

    if (!updates || typeof updates !== "object") {
      return errorResponse("updates must be an object", 400);
    }

    // Validate status if provided
    if (
      updates.status !== undefined &&
      !VALID_STATUSES.has(updates.status as PostStatus)
    ) {
      return errorResponse(`Invalid status: ${updates.status}`, 400);
    }

    // Only allow known fields
    const sanitized: BatchUpdateInput = {};
    if (updates.status !== undefined) sanitized.status = updates.status;
    if (updates.category_id !== undefined)
      sanitized.category_id = updates.category_id;

    if (Object.keys(sanitized).length === 0) {
      return errorResponse(
        "updates must contain at least one of: status, category_id",
        400,
      );
    }

    const db = getDb();
    const changed = await batchUpdatePosts(db, ids, sanitized);

    return jsonResponse({ changed });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
