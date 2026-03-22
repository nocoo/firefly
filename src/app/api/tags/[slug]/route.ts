import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse, notFoundResponse } from "@/lib/api";
import {
  getTagBySlug,
  updateTag,
  deleteTag,
  type UpdateTagInput,
} from "@/data/tags";

interface RouteParams {
  params: Promise<{ slug: string }>;
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
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

// PUT /api/tags/[slug]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const db = getDb();

    const existing = await getTagBySlug(db, slug);
    if (!existing) return notFoundResponse("Tag");

    const body = (await request.json()) as UpdateTagInput;
    const updated = await updateTag(db, existing.id, body);

    if (!updated) return notFoundResponse("Tag");

    return jsonResponse(updated);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
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
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
