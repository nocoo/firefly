import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse, notFoundResponse } from "@/lib/api";
import { deleteFromR2 } from "@/lib/r2-client";
import { getMedia, deleteMedia } from "@/data/media";

/**
 * GET /api/media/[id] — get a single media record.
 * Auth: protected by proxy (all methods on /api/media).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getDb();
    const media = await getMedia(db, id);

    if (!media) {
      return notFoundResponse("Media");
    }

    return jsonResponse(media);
  } catch (err) {
    console.error("Get media error:", err);
    return errorResponse("Failed to get media", 500);
  }
}

/**
 * DELETE /api/media/[id] — hard delete (DB + R2).
 * Auth: protected by proxy (all methods on /api/media).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getDb();
    const media = await getMedia(db, id);

    if (!media) {
      return notFoundResponse("Media");
    }

    // Delete from R2 first, then DB
    await deleteFromR2(media.r2_key);
    await deleteMedia(db, id);

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("Delete media error:", err);
    return errorResponse("Failed to delete media", 500);
  }
}
