import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import {
  listPosts,
  createPost,
  setPostTags,
  type CreatePostInput,
  type ListPostsOptions,
} from "@/data/posts";
import type { PostStatus } from "@/models/types";

// GET /api/posts — list posts with optional filters
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const options: ListPostsOptions = {};

    const status = searchParams.get("status");
    if (status) options.status = status as PostStatus;

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
    const body = (await request.json()) as CreatePostInput & {
      tag_ids?: string[];
    };

    if (!body.title?.trim()) {
      return errorResponse("title is required");
    }
    if (!body.slug?.trim()) {
      return errorResponse("slug is required");
    }
    if (!body.content && body.content !== "") {
      return errorResponse("content is required");
    }

    const post = await createPost(db, {
      title: body.title.trim(),
      slug: body.slug.trim(),
      content: body.content,
      status: body.status || "draft",
      excerpt: body.excerpt,
      category_id: body.category_id,
      featured_image: body.featured_image,
      comment_enabled: body.comment_enabled,
      published_at: body.published_at,
    });

    // Set tags if provided
    if (body.tag_ids && body.tag_ids.length > 0) {
      await setPostTags(db, post.id, body.tag_ids);
    }

    return jsonResponse(post, 201);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
