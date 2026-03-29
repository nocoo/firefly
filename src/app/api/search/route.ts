import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { searchPosts } from "@/data/entities/post";

// GET /api/search?q=...&page=1&page_size=10
// Dedicated FTS5 search endpoint — always returns published posts only.
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const query = searchParams.get("q");
    if (!query?.trim()) {
      return errorResponse("q query parameter is required");
    }

    const page = searchParams.get("page");
    const pageSize = searchParams.get("page_size");

    const result = await searchPosts(db, {
      query: query.trim(),
      status: "published",
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });

    return jsonResponse(result);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
