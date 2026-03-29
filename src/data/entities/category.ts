// ---------------------------------------------------------------------------
// Category entity — thin wrapper over taxonomy factory + category-only ops
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { Category } from "@/models/types";
import { createTaxonomyEntity } from "@/data/core/taxonomy-factory";
import { nowEpoch } from "@/data/core/timestamps";

// ---------------------------------------------------------------------------
// Input types (D5: camelCase)
// ---------------------------------------------------------------------------

export interface CreateCategoryInput {
  name: string;
  slug: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
  sortOrder?: number;
}

// ---------------------------------------------------------------------------
// Entity instance
// ---------------------------------------------------------------------------

const entity = createTaxonomyEntity<Category, CreateCategoryInput, UpdateCategoryInput>({
  table: "categories",
  entityName: "Category",
  fields: {
    name: { column: "name" },
    slug: { column: "slug" },
    description: { column: "description" },
    sortOrder: { column: "sort_order" },
  },
  orderBy: "sort_order DESC, name ASC",
  cacheTtl: 5 * 60 * 1000,
  insertColumns: ["id", "name", "slug", "description", "sort_order", "created_at", "updated_at"],
  buildInsertParams: (id, input, now) => [
    id,
    input.name,
    input.slug,
    input.description ?? null,
    input.sortOrder ?? 1,
    now,
    now,
  ],
});

// ---------------------------------------------------------------------------
// Re-exports (zero consumer changes)
// ---------------------------------------------------------------------------

export const listCategories = entity.list;
export const getCategoryBySlug = entity.getBySlug;
export const getCategoryById = entity.getById;
export const createCategory = entity.create;
export const updateCategory = entity.update;
export const deleteCategory = entity.delete;
export const invalidateCategoryCache = entity.invalidateCache;

// ---------------------------------------------------------------------------
// Category-only: reorderCategories
// ---------------------------------------------------------------------------

export async function reorderCategories(db: Db, ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const now = nowEpoch();
  const statements = ids.map((id, index) => ({
    sql: "UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ?",
    params: [ids.length - index, now, id] as unknown[],
  }));

  await db.batch(statements);
  entity.invalidateCache();
}

// ---------------------------------------------------------------------------
// Category-only: listCategoriesWithPostStats
// ---------------------------------------------------------------------------

export interface CategoryWithPostStats extends Category {
  total_posts: number;
  published_posts: number;
  draft_posts: number;
}

export async function listCategoriesWithPostStats(db: Db): Promise<CategoryWithPostStats[]> {
  const sql = `
    SELECT
      c.*,
      COUNT(p.id) AS total_posts,
      SUM(CASE WHEN p.status = 'published' THEN 1 ELSE 0 END) AS published_posts,
      SUM(CASE WHEN p.status = 'draft' THEN 1 ELSE 0 END) AS draft_posts
    FROM categories c
    LEFT JOIN posts p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.sort_order DESC, c.name ASC
  `;
  const result = await db.query<CategoryWithPostStats>(sql);
  return result.results;
}
