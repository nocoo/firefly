import { NextRequest } from "next/server";
import { getDb, DbError } from "@/lib/db";
import { jsonResponse, errorResponse, notFoundResponse } from "@/lib/api";
import {
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
  type UpdateCategoryInput,
} from "@/data/entities/category";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

function handleError(error: unknown) {
  if (error instanceof DbError) {
    return errorResponse(error.message, error.status ?? 500);
  }
  console.error("Categories API error:", error);
  return errorResponse("Internal server error", 500);
}

// GET /api/categories/[slug]
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const db = getDb();
    const category = await getCategoryBySlug(db, slug);

    if (!category) return notFoundResponse("Category");

    return jsonResponse(category);
  } catch (error) {
    return handleError(error);
  }
}

// PUT /api/categories/[slug]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const db = getDb();

    const existing = await getCategoryBySlug(db, slug);
    if (!existing) return notFoundResponse("Category");

    let body: UpdateCategoryInput & { sort_order?: number };
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body");
    }

    // Accept snake_case sort_order from API, map to camelCase
    const sortOrder = body.sortOrder ?? body.sort_order;
    const input: UpdateCategoryInput = {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.slug !== undefined && { slug: body.slug }),
      ...(body.description !== undefined && { description: body.description }),
      ...(sortOrder != null && { sortOrder }),
    };

    const updated = await updateCategory(db, existing.id, input);

    if (!updated) return notFoundResponse("Category");

    return jsonResponse(updated);
  } catch (error) {
    return handleError(error);
  }
}

// DELETE /api/categories/[slug]
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const db = getDb();

    const existing = await getCategoryBySlug(db, slug);
    if (!existing) return notFoundResponse("Category");

    const deleted = await deleteCategory(db, existing.id);
    if (!deleted) return notFoundResponse("Category");

    return jsonResponse({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
