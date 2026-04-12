import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse, notFoundResponse } from "@/lib/api";
import { getPostBySlug } from "@/data/entities/post";
import type { PostStatus } from "@/models/types";
import { PostService } from "@/services/post-service";
import { getAiAgentByCategoryId } from "@/data/entities/ai-agent";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET /api/posts/[slug]
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const db = getDb();

    // Public GET only returns published posts.
    // Admin edit page fetches via its own server component (getPostBySlug without status filter).
    const post = await getPostBySlug(db, slug, "published");

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

    const body = (await request.json()) as Record<string, unknown>;

    // Block moving post to an agent-bound category
    const newCategoryId = (body.categoryId ?? body.category_id) as string | null | undefined;
    if (newCategoryId && newCategoryId !== existing.category_id) {
      const agent = await getAiAgentByCategoryId(db, newCategoryId);
      if (agent) {
        return errorResponse(
          "Cannot move post to a category bound to an AI agent.",
          400,
        );
      }
    }

    const updated = await PostService.update(db, existing.id, {
      title: body.title as string | undefined,
      slug: body.slug as string | undefined,
      content: body.content as string | undefined,
      status: body.status as PostStatus | undefined,
      excerpt: body.excerpt as string | null | undefined,
      categoryId: (body.categoryId ?? body.category_id) as string | null | undefined,
      featuredImage: (body.featuredImage ?? body.featured_image) as string | null | undefined,
      commentEnabled: (body.commentEnabled ?? body.comment_enabled) as number | undefined,
      publishedAt: (body.publishedAt ?? body.published_at) as number | null | undefined,
      referenceUrl: (body.referenceUrl ?? body.reference_url) as string | null | undefined,
      referenceTitle: (body.referenceTitle ?? body.reference_title) as string | null | undefined,
      referenceDescription: (body.referenceDescription ?? body.reference_description) as string | null | undefined,
      referenceImage: (body.referenceImage ?? body.reference_image) as string | null | undefined,
      tagIds: (body.tagIds ?? body.tag_ids) as string[] | undefined,
    });

    if (!updated) return notFoundResponse("Post");

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

    const deleted = await PostService.delete(db, existing.id);
    if (!deleted) return notFoundResponse("Post");

    return jsonResponse({ deleted: true });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
