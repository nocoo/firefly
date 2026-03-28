import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import {
  listCategories,
  createCategory,
} from "@/data/entities/category";

// GET /api/categories
export async function GET() {
  try {
    const db = getDb();
    const categories = await listCategories(db);
    return jsonResponse(categories);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

// POST /api/categories
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await request.json()) as any;

    if (!body.name?.trim()) {
      return errorResponse("name is required");
    }
    if (!body.slug?.trim()) {
      return errorResponse("slug is required");
    }

    const category = await createCategory(db, {
      name: body.name.trim(),
      slug: body.slug.trim(),
      description: body.description,
      sortOrder: body.sortOrder ?? body.sort_order,
    });

    return jsonResponse(category, 201);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
