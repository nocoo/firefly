// ---------------------------------------------------------------------------
// MCP Category tools — CRUD for blog categories
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import {
  listCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/data/categories";

export interface ToolContext {
  db: Db;
}

// ---------------------------------------------------------------------------
// list_categories
// ---------------------------------------------------------------------------

export async function handleListCategories(ctx: ToolContext) {
  const categories = await listCategories(ctx.db);

  return {
    content: [
      { type: "text" as const, text: JSON.stringify(categories, null, 2) },
    ],
  };
}

// ---------------------------------------------------------------------------
// get_category
// ---------------------------------------------------------------------------

export async function handleGetCategory(
  ctx: ToolContext,
  args: { slug: string },
) {
  const category = await getCategoryBySlug(ctx.db, args.slug);
  if (!category) {
    return {
      content: [{ type: "text" as const, text: `Category not found: ${args.slug}` }],
      isError: true,
    };
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify(category, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// create_category
// ---------------------------------------------------------------------------

export async function handleCreateCategory(
  ctx: ToolContext,
  args: { name: string; slug: string; description?: string; sort_order?: number },
) {
  const category = await createCategory(ctx.db, {
    name: args.name,
    slug: args.slug,
    description: args.description,
    sort_order: args.sort_order,
  });

  return {
    content: [{ type: "text" as const, text: JSON.stringify(category, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// update_category
// ---------------------------------------------------------------------------

export async function handleUpdateCategory(
  ctx: ToolContext,
  args: {
    slug: string;
    name?: string;
    new_slug?: string;
    description?: string | null;
    sort_order?: number;
  },
) {
  const existing = await getCategoryBySlug(ctx.db, args.slug);
  if (!existing) {
    return {
      content: [{ type: "text" as const, text: `Category not found: ${args.slug}` }],
      isError: true,
    };
  }

  const updated = await updateCategory(ctx.db, existing.id, {
    name: args.name,
    slug: args.new_slug,
    description: args.description,
    sort_order: args.sort_order,
  });

  return {
    content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// delete_category
// ---------------------------------------------------------------------------

export async function handleDeleteCategory(
  ctx: ToolContext,
  args: { slug: string },
) {
  const existing = await getCategoryBySlug(ctx.db, args.slug);
  if (!existing) {
    return {
      content: [{ type: "text" as const, text: `Category not found: ${args.slug}` }],
      isError: true,
    };
  }

  await deleteCategory(ctx.db, existing.id);

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ deleted: true }) }],
  };
}
