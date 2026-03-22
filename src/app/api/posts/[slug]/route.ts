import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse, notFoundResponse } from "@/lib/api";
import {
  getPostBySlug,
  updatePost,
  deletePost,
  setPostTags,
  type UpdatePostInput,
} from "@/data/posts";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET /api/posts/[slug]
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const db = getDb();
    const post = await getPostBySlug(db, slug);

    if (!post) return notFoundResponse("Post");

    return jsonResponse(post);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

// PUT /api/posts/[slug]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const db = getDb();

    // First find the post by slug to get its ID
    const existing = await getPostBySlug(db, slug);
    if (!existing) return notFoundResponse("Post");

    const body = (await request.json()) as UpdatePostInput & {
      tag_ids?: string[];
    };
    const { tag_ids, ...updateInput } = body;
    const updated = await updatePost(db, existing.id, updateInput);

    if (!updated) return notFoundResponse("Post");

    // Update tags if provided
    if (tag_ids) {
      await setPostTags(db, existing.id, tag_ids);
    }

    return jsonResponse(updated);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

// DELETE /api/posts/[slug]
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const db = getDb();

    const existing = await getPostBySlug(db, slug);
    if (!existing) return notFoundResponse("Post");

    const deleted = await deletePost(db, existing.id);
    if (!deleted) return notFoundResponse("Post");

    return jsonResponse({ deleted: true });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
