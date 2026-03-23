// ---------------------------------------------------------------------------
// Category data layer — CRUD operations
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { Category } from "@/models/types";
import { createCache } from "@/lib/cache";
import { ulid } from "ulid";

// ---------------------------------------------------------------------------
// Process-level cache (TTL = 5 min)
// ---------------------------------------------------------------------------

const categoriesCache = createCache<Category[]>(5 * 60 * 1000);

/** Force next `listCategories` call to re-fetch from DB. */
export function invalidateCategoriesCache(): void {
  categoriesCache.invalidate();
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateCategoryInput {
  name: string;
  slug: string;
  description?: string | undefined;
  sort_order?: number | undefined;
}

export interface UpdateCategoryInput {
  name?: string | undefined;
  slug?: string | undefined;
  description?: string | null | undefined;
  sort_order?: number | undefined;
}

// ---------------------------------------------------------------------------
// listCategories
// ---------------------------------------------------------------------------

export async function listCategories(db: Db): Promise<Category[]> {
  const cached = categoriesCache.get();
  if (cached) return cached;

  const result = await db.query<Category>(
    "SELECT * FROM categories ORDER BY sort_order ASC, name ASC",
  );
  categoriesCache.set(result.results);
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
  const id = ulid();
  const now = Math.floor(Date.now() / 1000);

  const sql = `
    INSERT INTO categories (id, name, slug, description, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  await db.execute(sql, [
    id,
    input.name,
    input.slug,
    input.description ?? null,
    input.sort_order ?? 0,
    now,
    now,
  ]);

  const category = await getCategoryById(db, id);
  if (!category) throw new Error(`Failed to retrieve category ${id} after creation`);
  invalidateCategoriesCache();
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
  const setClauses: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) {
    setClauses.push("name = ?");
    params.push(input.name);
  }

  if (input.slug !== undefined) {
    setClauses.push("slug = ?");
    params.push(input.slug);
  }

  if (input.description !== undefined) {
    setClauses.push("description = ?");
    params.push(input.description);
  }

  if (input.sort_order !== undefined) {
    setClauses.push("sort_order = ?");
    params.push(input.sort_order);
  }

  if (setClauses.length === 0) return getCategoryById(db, id);

  setClauses.push("updated_at = ?");
  params.push(Math.floor(Date.now() / 1000));
  params.push(id);

  const sql = `UPDATE categories SET ${setClauses.join(", ")} WHERE id = ?`;
  await db.execute(sql, params);

  invalidateCategoriesCache();
  return getCategoryById(db, id);
}

// ---------------------------------------------------------------------------
// deleteCategory
// ---------------------------------------------------------------------------

export async function deleteCategory(db: Db, id: string): Promise<boolean> {
  const meta = await db.execute("DELETE FROM categories WHERE id = ?", [id]);
  if (meta.changes > 0) invalidateCategoriesCache();
  return meta.changes > 0;
}
