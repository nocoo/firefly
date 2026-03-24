import { NextRequest } from "next/server";
import { getDb, DbError } from "@/lib/db";
import { jsonResponse, errorResponse, notFoundResponse } from "@/lib/api";
import {
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
  type UpdateCategoryInput,
} from "@/data/categories";

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

    let body: UpdateCategoryInput;
    try {
      body = (await request.json()) as UpdateCategoryInput;
    } catch {
      return errorResponse("Invalid JSON body");
    }

    const updated = await updateCategory(db, existing.id, body);

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
