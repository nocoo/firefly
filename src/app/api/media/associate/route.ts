import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { associateMedia } from "@/data/media";

/**
 * PATCH /api/media/associate — backfill post_id on orphaned media records.
 *
 * Used after creating a new post: uploads during editing had post_id = NULL
 * because the post didn't exist yet. This endpoint associates them.
 *
 * Body: { mediaIds: string[], postId: string }
 * Auth required.
 */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const body = await request.json();
    const { mediaIds, postId } = body as {
      mediaIds: unknown;
      postId: unknown;
    };

    // Validate input
    if (
      !Array.isArray(mediaIds) ||
      mediaIds.length === 0 ||
      !mediaIds.every((id): id is string => typeof id === "string")
    ) {
      return errorResponse("mediaIds must be a non-empty array of strings", 400);
    }

    if (typeof postId !== "string" || postId.length === 0) {
      return errorResponse("postId must be a non-empty string", 400);
    }

    const db = getDb();

    // Validate postId exists
    const post = await db.firstOrNull<{ id: string }>(
      "SELECT id FROM posts WHERE id = ?",
      [postId],
    );
    if (!post) {
      return errorResponse("Post not found", 400);
    }

    const updated = await associateMedia(db, mediaIds, postId);

    return jsonResponse({ updated });
  } catch (err) {
    console.error("Associate media error:", err);
    return errorResponse("Failed to associate media", 500);
  }
}
