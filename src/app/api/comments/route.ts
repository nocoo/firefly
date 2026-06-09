import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { createComment } from "@/data/entities/comment";
import { getPostById, invalidatePostCaches } from "@/data/entities/post";
import { getSiteSettings } from "@/data/settings";

/**
 * POST /api/comments — create a new comment.
 *
 * Currently admin-only: only the authenticated site owner can post (and reply).
 * This keeps the comment surface useful (the owner can answer reader email →
 * threaded reply) without inviting moderation queue work. Open submission
 * needs spam protection, captcha, and a moderation flow — out of scope for
 * this round; see docs/24 wave-4 for the explicit decision.
 *
 * Availability rule must mirror the page surface (slug page line 103):
 *   settings.commentsEnabled  AND  post.comment_enabled  AND  status === "published"
 *
 * If any of those is false the route returns 403 — even for the admin —
 * because creating a comment on a post where comments are disabled would
 * leave the comment orphaned (the page never renders the section to show it).
 * The not-found post is reported as 404 separately so callers can distinguish.
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

    // Verify the target post exists, is published, and has comments enabled
    // both globally and per-post. This must match the visibility rule on the
    // detail page so an admin can't create a comment that nobody can see.
    const [post, settings] = await Promise.all([
      getPostById(db, postId),
      getSiteSettings(db),
    ]);
    if (!post) {
      return errorResponse("Post not found", 404);
    }
    if (post.status !== "published") {
      return errorResponse("Comments are not allowed on this post", 403);
    }
    if (!settings.commentsEnabled || !post.comment_enabled) {
      return errorResponse("Comments are disabled for this post", 403);
    }

    // If a reply, the parent must belong to the same post — prevents posting
    // a child comment that points at an unrelated thread.
    if (parentId) {
      const parent = await db.firstOrNull<{ post_id: string }>(
        "SELECT post_id FROM comments WHERE id = ?",
        [parentId],
      );
      if (!parent || parent.post_id !== postId) {
        return errorResponse("Invalid parent comment", 400);
      }
    }

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
