import { NextRequest } from "next/server";
import { getDb, DbError } from "@/lib/db";
import { jsonResponse, errorResponse, notFoundResponse } from "@/lib/api";
import {
  getTagBySlug,
  updateTag,
  deleteTag,
  type UpdateTagInput,
} from "@/data/entities/tag";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

function handleError(error: unknown) {
  if (error instanceof DbError) {
    return errorResponse(error.message, error.status ?? 500);
  }
  console.error("Tags API error:", error);
  return errorResponse("Internal server error", 500);
}

// GET /api/tags/[slug]
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const db = getDb();
    const tag = await getTagBySlug(db, slug);

    if (!tag) return notFoundResponse("Tag");

    return jsonResponse(tag);
  } catch (error) {
    return handleError(error);
  }
}

// PUT /api/tags/[slug]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const db = getDb();

    const existing = await getTagBySlug(db, slug);
    if (!existing) return notFoundResponse("Tag");

    let body: UpdateTagInput;
    try {
      body = (await request.json()) as UpdateTagInput;
    } catch {
      return errorResponse("Invalid JSON body");
    }

    const updated = await updateTag(db, existing.id, body);

    if (!updated) return notFoundResponse("Tag");

    return jsonResponse(updated);
  } catch (error) {
    return handleError(error);
  }
}

// DELETE /api/tags/[slug]
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const db = getDb();

    const existing = await getTagBySlug(db, slug);
    if (!existing) return notFoundResponse("Tag");

    const deleted = await deleteTag(db, existing.id);
    if (!deleted) return notFoundResponse("Tag");

    return jsonResponse({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
