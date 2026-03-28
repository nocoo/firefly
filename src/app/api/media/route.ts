import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { uploadToR2, getR2PublicUrl } from "@/lib/r2-client";
import { generateFireflyR2Key } from "@/lib/r2";
import { listMedia, createMedia } from "@/data/entities/media";

/**
 * GET /api/media — list media with pagination and filters.
 *
 * Query params: page, page_size, post_id, search, mime_type, year, month, sort_by, sort_order
 * Auth: protected by proxy — GET is admin-only via proxy rule.
 */
export async function GET(request: NextRequest) {

  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const pageSize =
    parseInt(searchParams.get("page_size") ?? "120", 10) || 120;
  const postId = searchParams.get("post_id") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const mimeType = searchParams.get("mime_type") ?? undefined;
  const yearRaw = searchParams.get("year");
  const monthRaw = searchParams.get("month");
  const year = yearRaw ? parseInt(yearRaw, 10) || undefined : undefined;
  const month = monthRaw ? parseInt(monthRaw, 10) || undefined : undefined;
  const sortBy = (searchParams.get("sort_by") as "created_at" | "size" | "filename") ?? undefined;
  const sortOrder = (searchParams.get("sort_order") as "asc" | "desc") ?? undefined;

  try {
    const db = getDb();
    const result = await listMedia(db, {
      page,
      pageSize,
      ...(postId ? { postId } : {}),
      ...(search ? { search } : {}),
      ...(mimeType ? { mimeType } : {}),
      ...(year ? { year } : {}),
      ...(month ? { month } : {}),
      ...(sortBy ? { sortBy } : {}),
      ...(sortOrder ? { sortOrder } : {}),
    });

    // Enrich with public URLs
    const publicBaseUrl = getR2PublicUrl();
    const media = result.media.map((m) => ({
      ...m,
      url: `${publicBaseUrl}/${m.r2_key}`,
    }));

    return jsonResponse({
      media,
      total: result.total,
      page,
      pageSize,
    });
  } catch (err) {
    console.error("List media error:", err);
    return errorResponse("Failed to list media", 500);
  }
}

/**
 * POST /api/media — upload file to R2 and create DB record.
 *
 * Accepts multipart/form-data with "file" field + optional "post_id".
 * Auth: protected by proxy (all methods on /api/media).
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const postId = (formData.get("post_id") as string) ?? undefined;

    if (!file || !(file instanceof File)) {
      return errorResponse("No file provided", 400);
    }

    // Upload to R2
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = generateFireflyR2Key(file.name);
    const r2Result = await uploadToR2(buffer, file.name, file.type, key);

    // Create DB record
    const db = getDb();
    const media = await createMedia(db, {
      filename: file.name,
      r2Key: r2Result.key,
      mimeType: r2Result.mimeType,
      size: r2Result.size,
      ...(postId ? { postId } : {}),
    });

    return jsonResponse(
      {
        ...media,
        url: r2Result.url,
      },
      201,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";

    // Validation errors → 400, everything else → 500
    if (
      message.includes("File too large") ||
      message.includes("Unsupported file type") ||
      message.includes("MIME type mismatch") ||
      message.includes("does not match any supported image format")
    ) {
      return errorResponse(message, 400);
    }

    console.error("Media upload error:", err);
    return errorResponse(message, 500);
  }
}
