// ---------------------------------------------------------------------------
// Post entity — tag operations (D4: pure batch, NO count refresh)
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";

type TagRow = { id: string; name: string; slug: string };

export async function getPostTags(
  db: Db,
  postId: string,
): Promise<TagRow[]> {
  const sql = `
    SELECT t.id, t.name, t.slug
    FROM tags t
    INNER JOIN post_tags pt ON pt.tag_id = t.id
    WHERE pt.post_id = ?
    ORDER BY t.name
  `;
  const result = await db.query<TagRow>(sql, [postId]);
  return result.results;
}

export async function getPostsTagsMap(
  db: Db,
  postIds: string[],
): Promise<Map<string, TagRow[]>> {
  if (postIds.length === 0) return new Map();

  const placeholders = postIds.map(() => "?").join(", ");
  const sql = `
    SELECT pt.post_id, t.id, t.name, t.slug
    FROM tags t
    INNER JOIN post_tags pt ON pt.tag_id = t.id
    WHERE pt.post_id IN (${placeholders})
    ORDER BY t.name
  `;
  const result = await db.query<{ post_id: string } & TagRow>(sql, postIds);

  const map = new Map<string, TagRow[]>();
  for (const row of result.results) {
    const existing = map.get(row.post_id) ?? [];
    existing.push({ id: row.id, name: row.name, slug: row.slug });
    map.set(row.post_id, existing);
  }
  return map;
}

export async function setPostTags(
  db: Db,
  postId: string,
  tagIds: string[],
): Promise<void> {
  const statements = [
    {
      sql: "DELETE FROM post_tags WHERE post_id = ?",
      params: [postId] as unknown[],
    },
    ...tagIds.map((tagId) => ({
      sql: "INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)",
      params: [postId, tagId] as unknown[],
    })),
  ];

  if (statements.length > 1) {
    await db.batch(statements);
  } else {
    await db.execute(statements[0].sql, statements[0].params);
  }
}
