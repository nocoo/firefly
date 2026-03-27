import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { listPosts, type ListPostsOptions } from "@/data/posts";
import type { PostStatus } from "@/models/types";

// GET /api/admin/posts — admin-only list with all statuses
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const options: ListPostsOptions = { sortBy: "created_at" };

    const status = searchParams.get("status") as PostStatus | null;
    if (status) options.status = status;

    const categoryId = searchParams.get("category");
    if (categoryId) options.categoryId = categoryId;

    const tagId = searchParams.get("tag");
    if (tagId) options.tagId = tagId;

    const query = searchParams.get("q");
    if (query) options.query = query;

    const year = searchParams.get("year");
    if (year) options.archiveYear = parseInt(year, 10);

    const month = searchParams.get("month");
    if (month) options.archiveMonth = parseInt(month, 10);

    const page = searchParams.get("page");
    if (page) options.page = parseInt(page, 10);

    const pageSize = searchParams.get("pageSize");
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
