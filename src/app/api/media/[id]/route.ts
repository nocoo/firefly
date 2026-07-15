import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse, notFoundResponse } from "@/lib/api";
import { getR2ClientAdapter } from "@/lib/r2-client";
import { getMediaById } from "@/data/entities/media";
import { MediaService } from "@/services/media-service";

/**
 * GET /api/media/[id] — get a single media record.
 *
 * Auth: in-route check (defense in depth — proxy authGuard also runs).
 */
export async function GET(
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
    const media = await getMediaById(db, id);

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
 * DELETE /api/media/[id] — hard delete (DB primary, R2 best-effort).
 *
 * DB record is the primary truth — deleted first.
 * R2 object deletion is best-effort; if it fails, an orphan R2 key is logged
 * for periodic cleanup (D6 contract).
 *
 * Auth: in-route check (defense in depth — proxy authGuard also runs).
 */
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

    const media = await getMediaById(db, id);
    if (!media) {
      return notFoundResponse("Media");
    }

    const r2 = getR2ClientAdapter();
    const deleted = await MediaService.delete(db, r2, id);
    if (!deleted) return notFoundResponse("Media");

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("Delete media error:", err);
    return errorResponse("Failed to delete media", 500);
  }
}
