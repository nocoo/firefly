// ---------------------------------------------------------------------------
// Tag entity — pure CRUD with cache
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { Tag } from "@/models/types";
import { EntityCacheManager } from "@/data/core/cache-manager";
import { nowEpoch, newId } from "@/data/core/timestamps";
import { buildSetClauses } from "@/data/core/sql";

// ---------------------------------------------------------------------------
// Entity config
// ---------------------------------------------------------------------------

const fields = {
  name: { column: "name" },
  slug: { column: "slug" },
} as const;

const CACHE_TTL = 5 * 60 * 1000;
const cache = new EntityCacheManager<Tag[]>(CACHE_TTL);

/** Force next `listTags` call to re-fetch from DB. */
export function invalidateTagCache(): void {
  cache.invalidate();
}

// ---------------------------------------------------------------------------
// Input types (D5: camelCase)
// ---------------------------------------------------------------------------

export interface CreateTagInput {
  name: string;
  slug: string;
}

export interface UpdateTagInput {
  name?: string;
  slug?: string;
}

// ---------------------------------------------------------------------------
// listTags
// ---------------------------------------------------------------------------

export async function listTags(db: Db): Promise<Tag[]> {
  const cached = cache.get();
  if (cached) return cached;

  const result = await db.query<Tag>(
    "SELECT * FROM tags ORDER BY name ASC",
  );
  cache.set(result.results);
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
  const id = newId();
  const now = nowEpoch();

  await db.execute(
    `INSERT INTO tags (id, name, slug, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, input.name, input.slug, now, now],
  );

  const tag = await getTagById(db, id);
  if (!tag) throw new Error(`Failed to retrieve Tag ${id} after creation`);
  invalidateTagCache();
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
  const { setClauses, params } = buildSetClauses(
    input as unknown as Record<string, unknown>,
    fields,
  );
  if (setClauses.length === 0) return getTagById(db, id);

  setClauses.push("updated_at = ?");
  params.push(nowEpoch());
  params.push(id);

  await db.execute(
    `UPDATE tags SET ${setClauses.join(", ")} WHERE id = ?`,
    params,
  );

  invalidateTagCache();
  return getTagById(db, id);
}

// ---------------------------------------------------------------------------
// deleteTag
// ---------------------------------------------------------------------------

export async function deleteTag(db: Db, id: string): Promise<boolean> {
  const meta = await db.execute("DELETE FROM tags WHERE id = ?", [id]);
  if (meta.changes > 0) invalidateTagCache();
  return meta.changes > 0;
}
