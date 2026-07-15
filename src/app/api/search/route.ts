import type { NextRequest } from "next/server";
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

    const rawPage = searchParams.get("page");
    const rawPageSize = searchParams.get("page_size");

    // Parse and validate — NaN / non-positive fall back to undefined (use defaults)
    const page = rawPage ? safePositiveInt(rawPage) : undefined;
    const pageSize = rawPageSize ? safePositiveInt(rawPageSize) : undefined;

    const result = await searchPosts(db, {
      query: query.trim(),
      status: "published",
      page,
      pageSize,
    });

    return jsonResponse(result);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

/** Parse string to positive integer, return undefined for invalid input. */
function safePositiveInt(value: string): number | undefined {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 ? n : undefined;
}
