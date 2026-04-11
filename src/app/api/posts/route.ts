import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { listPosts, type ListPostsOptions } from "@/data/entities/post";
import type { PostStatus } from "@/models/types";
import { PostService } from "@/services/post-service";

// GET /api/posts — list posts with optional filters
export async function GET(request: NextRequest) {
  try {
    // Debug: log env vars (only in CI)
    if (process.env.CI === "true") {
      console.log("[DEBUG] WORKER_URL:", process.env.WORKER_URL ? "(set)" : "(missing)");
      console.log("[DEBUG] WORKER_SECRET:", process.env.WORKER_SECRET ? "(set)" : "(missing)");
    }

    const db = getDb();
    const { searchParams } = new URL(request.url);

    const options: ListPostsOptions = {};

    // Public GET always returns published posts only.
    // The status query param is ignored — unauthenticated GET requests
    // must never see draft/private/archived content.
    // Admin uses server components with direct data access, not this API.
    options.status = "published";

    const categoryId = searchParams.get("category_id");
    if (categoryId) options.categoryId = categoryId;

    const tagId = searchParams.get("tag_id");
    if (tagId) options.tagId = tagId;

    const query = searchParams.get("q");
    if (query) options.query = query;

    const page = searchParams.get("page");
    if (page) options.page = parseInt(page, 10);

    const pageSize = searchParams.get("page_size");
    if (pageSize) options.pageSize = parseInt(pageSize, 10);

    const result = await listPosts(db, options);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

// POST /api/posts — create a new post
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = (await request.json()) as Record<string, unknown>;

    const title = body.title as string | undefined;
    const slug = body.slug as string | undefined;

    if (!title?.trim()) {
      return errorResponse("title is required");
    }
    if (!slug?.trim()) {
      return errorResponse("slug is required");
    }
    if (!body.content && body.content !== "") {
      return errorResponse("content is required");
    }

    const post = await PostService.create(db, {
      title: title.trim(),
      slug: slug.trim(),
      content: body.content as string,
      status: (body.status as PostStatus) || "draft",
      excerpt: body.excerpt as string | undefined,
      categoryId: (body.categoryId ?? body.category_id) as string | undefined,
      featuredImage: (body.featuredImage ?? body.featured_image) as string | undefined,
      commentEnabled: (body.commentEnabled ?? body.comment_enabled) as number | undefined,
      publishedAt: (body.publishedAt ?? body.published_at) as number | undefined,
      referenceUrl: (body.referenceUrl ?? body.reference_url) as string | undefined,
      referenceTitle: (body.referenceTitle ?? body.reference_title) as string | undefined,
      referenceDescription: (body.referenceDescription ?? body.reference_description) as string | undefined,
      referenceImage: (body.referenceImage ?? body.reference_image) as string | undefined,
      tagIds: (body.tagIds ?? body.tag_ids) as string[] | undefined,
    });

    return jsonResponse(post, 201);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
