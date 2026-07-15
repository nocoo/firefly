import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { searchPosts } from "@/data/entities/post";

// GET /api/admin/search?q=... — admin-only FTS search across all statuses
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  if (!query) {
    return jsonResponse({ posts: [], snippets: {}, total: 0, page: 1, pageSize: 10 });
  }

  try {
    const db = getDb();
    const result = await searchPosts(db, {
      query,
      status: null, // search all statuses for admin
      pageSize: 10,
    });
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
