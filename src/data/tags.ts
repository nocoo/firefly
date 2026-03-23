// ---------------------------------------------------------------------------
// Tag data layer — CRUD operations
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { Tag } from "@/models/types";
import { createCache } from "@/lib/cache";
import { ulid } from "ulid";

// ---------------------------------------------------------------------------
// Process-level cache (TTL = 5 min)
// ---------------------------------------------------------------------------

const tagsCache = createCache<Tag[]>(5 * 60 * 1000);

/** Force next `listTags` call to re-fetch from DB. */
export function invalidateTagsCache(): void {
  tagsCache.invalidate();
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateTagInput {
  name: string;
  slug: string;
}

export interface UpdateTagInput {
  name?: string | undefined;
  slug?: string | undefined;
}

// ---------------------------------------------------------------------------
// listTags
// ---------------------------------------------------------------------------

export async function listTags(db: Db): Promise<Tag[]> {
  const cached = tagsCache.get();
  if (cached) return cached;

  const result = await db.query<Tag>(
    "SELECT * FROM tags ORDER BY name ASC",
  );
  tagsCache.set(result.results);
  return result.results;
}

// ---------------------------------------------------------------------------
// getTagBySlug
// ---------------------------------------------------------------------------

export async function getTagBySlug(
  db: Db,
  slug: string,
): Promise<Tag | null> {
  return db.firstOrNull<Tag>(
    "SELECT * FROM tags WHERE slug = ?",
    [slug],
  );
}

// ---------------------------------------------------------------------------
// getTagById
// ---------------------------------------------------------------------------

export async function getTagById(
  db: Db,
  id: string,
): Promise<Tag | null> {
  return db.firstOrNull<Tag>(
    "SELECT * FROM tags WHERE id = ?",
    [id],
  );
}

// ---------------------------------------------------------------------------
// createTag
// ---------------------------------------------------------------------------

export async function createTag(
  db: Db,
  input: CreateTagInput,
): Promise<Tag> {
  const id = ulid();
  const now = Math.floor(Date.now() / 1000);

  const sql = `
    INSERT INTO tags (id, name, slug, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `;

  await db.execute(sql, [id, input.name, input.slug, now, now]);

  const tag = await getTagById(db, id);
  if (!tag) throw new Error(`Failed to retrieve tag ${id} after creation`);
  invalidateTagsCache();
  return tag;
}

// ---------------------------------------------------------------------------
// updateTag
// ---------------------------------------------------------------------------

export async function updateTag(
  db: Db,
  id: string,
  input: UpdateTagInput,
): Promise<Tag | null> {
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

  if (setClauses.length === 0) return getTagById(db, id);

  setClauses.push("updated_at = ?");
  params.push(Math.floor(Date.now() / 1000));
  params.push(id);

  const sql = `UPDATE tags SET ${setClauses.join(", ")} WHERE id = ?`;
  await db.execute(sql, params);

  invalidateTagsCache();
  return getTagById(db, id);
}

// ---------------------------------------------------------------------------
// deleteTag
// ---------------------------------------------------------------------------

export async function deleteTag(db: Db, id: string): Promise<boolean> {
  const meta = await db.execute("DELETE FROM tags WHERE id = ?", [id]);
  if (meta.changes > 0) invalidateTagsCache();
  return meta.changes > 0;
}
