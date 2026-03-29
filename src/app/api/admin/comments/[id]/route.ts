import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { deleteComment } from "@/data/entities/comment";
import { invalidatePostCaches } from "@/data/entities/post";

// DELETE /api/admin/comments/[id] — admin-only comment deletion
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await params;
    const db = getDb();
    const deleted = await deleteComment(db, id);

    if (!deleted) {
      return errorResponse("Comment not found", 404);
    }

    invalidatePostCaches();
    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
