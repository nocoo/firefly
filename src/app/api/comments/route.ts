import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { createComment } from "@/data/entities/comment";
import { invalidatePostCaches } from "@/data/entities/post";

/**
 * POST /api/comments — create a new comment.
 *
 * Currently admin-only: only the authenticated site owner can post (and reply).
 * This keeps the comment surface useful (the owner can answer reader email →
 * threaded reply) without inviting moderation queue work. Open submission
 * needs spam protection, captcha, and a moderation flow — out of scope for
 * this round; see docs/24 wave-4 for the explicit decision.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const postId = body.post_id;
  const content = body.content;
  if (typeof postId !== "string" || !postId) {
    return errorResponse("post_id is required");
  }
  if (typeof content !== "string" || !content.trim()) {
    return errorResponse("content is required");
  }
  if (content.length > 4000) {
    return errorResponse("content exceeds 4000 characters");
  }

  const parentId =
    typeof body.parent_id === "string" && body.parent_id ? body.parent_id : null;
  const authorName =
    typeof body.author_name === "string" && body.author_name.trim()
      ? body.author_name.trim()
      : (session.user.name ?? "Admin");

  try {
    const db = getDb();
    const comment = await createComment(db, {
      postId,
      authorName,
      content: content.trim(),
      parentId,
      authorEmail: session.user.email ?? null,
    });
    invalidatePostCaches();
    return jsonResponse(comment, 201);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
