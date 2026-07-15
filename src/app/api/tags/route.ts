import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import {
  listTags,
  createTag,
  type CreateTagInput,
} from "@/data/entities/tag";

// GET /api/tags
export async function GET() {
  try {
    const db = getDb();
    const tags = await listTags(db);
    return jsonResponse(tags);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

// POST /api/tags
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = (await request.json()) as CreateTagInput;

    if (!body.name?.trim()) {
      return errorResponse("name is required");
    }
    if (!body.slug?.trim()) {
      return errorResponse("slug is required");
    }

    const tag = await createTag(db, {
      name: body.name.trim(),
      slug: body.slug.trim(),
    });

    return jsonResponse(tag, 201);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
