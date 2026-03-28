// ---------------------------------------------------------------------------
// Category entity — CRUD + reorder + post stats
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { Category } from "@/models/types";
import { EntityCacheManager } from "@/data/core/cache-manager";
import { nowEpoch, newId } from "@/data/core/timestamps";
import { buildSetClauses } from "@/data/core/sql";

// ---------------------------------------------------------------------------
// Entity config
// ---------------------------------------------------------------------------

const fields = {
  name: { column: "name" },
  slug: { column: "slug" },
  description: { column: "description" },
  sortOrder: { column: "sort_order" },
} as const;

const CACHE_TTL = 5 * 60 * 1000;
const cache = new EntityCacheManager<Category[]>(CACHE_TTL);

/** Force next `listCategories` call to re-fetch from DB. */
export function invalidateCategoryCache(): void {
  cache.invalidate();
}

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
// CategoryWithPostStats (admin only)
// ---------------------------------------------------------------------------

export interface CategoryWithPostStats extends Category {
  total_posts: number;
  published_posts: number;
  draft_posts: number;
}

// ---------------------------------------------------------------------------
// listCategories
// ---------------------------------------------------------------------------

export async function listCategories(db: Db): Promise<Category[]> {
  const cached = cache.get();
  if (cached) return cached;

  const result = await db.query<Category>(
    "SELECT * FROM categories ORDER BY sort_order DESC, name ASC",
  );
  cache.set(result.results);
  return result.results;
}

// ---------------------------------------------------------------------------
// getCategoryBySlug
// ---------------------------------------------------------------------------

export async function getCategoryBySlug(
  db: Db,
  slug: string,
): Promise<Category | null> {
  return db.firstOrNull<Category>(
    "SELECT * FROM categories WHERE slug = ?",
    [slug],
  );
}

// ---------------------------------------------------------------------------
// getCategoryById
// ---------------------------------------------------------------------------

export async function getCategoryById(
  db: Db,
  id: string,
): Promise<Category | null> {
  return db.firstOrNull<Category>(
    "SELECT * FROM categories WHERE id = ?",
    [id],
  );
}

// ---------------------------------------------------------------------------
// createCategory
// ---------------------------------------------------------------------------

export async function createCategory(
  db: Db,
  input: CreateCategoryInput,
): Promise<Category> {
  const id = newId();
  const now = nowEpoch();

  await db.execute(
    `INSERT INTO categories (id, name, slug, description, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.slug,
      input.description ?? null,
      input.sortOrder ?? 1,
      now,
      now,
    ],
  );

  const category = await getCategoryById(db, id);
  if (!category) throw new Error(`Failed to retrieve Category ${id} after creation`);
  invalidateCategoryCache();
  return category;
}

// ---------------------------------------------------------------------------
// updateCategory
// ---------------------------------------------------------------------------

export async function updateCategory(
  db: Db,
  id: string,
  input: UpdateCategoryInput,
): Promise<Category | null> {
  if (Object.keys(input).length === 0) return getCategoryById(db, id);

  const { setClauses, params } = buildSetClauses(input, fields);
  if (setClauses.length === 0) return getCategoryById(db, id);

  setClauses.push("updated_at = ?");
  params.push(nowEpoch());
  params.push(id);

  await db.execute(
    `UPDATE categories SET ${setClauses.join(", ")} WHERE id = ?`,
    params,
  );

  invalidateCategoryCache();
  return getCategoryById(db, id);
}

// ---------------------------------------------------------------------------
// deleteCategory
// ---------------------------------------------------------------------------

export async function deleteCategory(db: Db, id: string): Promise<boolean> {
  const meta = await db.execute("DELETE FROM categories WHERE id = ?", [id]);
  if (meta.changes > 0) invalidateCategoryCache();
  return meta.changes > 0;
}

// ---------------------------------------------------------------------------
// reorderCategories
// ---------------------------------------------------------------------------

export async function reorderCategories(
  db: Db,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;

  const now = nowEpoch();
  const statements = ids.map((id, index) => ({
    sql: "UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ?",
    params: [ids.length - index, now, id] as unknown[],
  }));

  await db.batch(statements);
  invalidateCategoryCache();
}

// ---------------------------------------------------------------------------
// listCategoriesWithPostStats (admin only)
// ---------------------------------------------------------------------------

export async function listCategoriesWithPostStats(
  db: Db,
): Promise<CategoryWithPostStats[]> {
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
