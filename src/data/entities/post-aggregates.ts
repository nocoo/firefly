// ---------------------------------------------------------------------------
// Post entity — aggregates (archives, years, adjacency, count refresh)
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type {
  AdjacentPost,
  AdjacentPosts,
  MonthlyArchive,
  PostYearCount,
} from "./post-types";
import { archivesCache } from "./post-cache";

/**
 * Refresh post_count for a specific category by counting published posts.
 * Pass null/undefined for no-op.
 */
export async function refreshCategoryPostCount(
  db: Db,
  categoryId: string | null | undefined,
): Promise<void> {
  if (!categoryId) return;
  await db.execute(
    `UPDATE categories SET post_count = (
      SELECT COUNT(*) FROM posts WHERE category_id = ? AND status = 'published'
    ) WHERE id = ?`,
    [categoryId, categoryId],
  );
}

/** Refresh post_count for ALL categories from ground truth. */
export async function refreshAllCategoryPostCounts(db: Db): Promise<void> {
  await db.execute(
    `UPDATE categories SET post_count = (
      SELECT COUNT(*) FROM posts
      WHERE posts.category_id = categories.id AND posts.status = 'published'
    )`,
  );
}

/** Refresh post_count for ALL tags from ground truth. */
export async function refreshAllTagPostCounts(db: Db): Promise<void> {
  await db.execute(
    `UPDATE tags SET post_count = (
      SELECT COUNT(*) FROM post_tags pt
      INNER JOIN posts p ON p.id = pt.post_id AND p.status = 'published'
      WHERE pt.tag_id = tags.id
    )`,
  );
}

export async function listMonthlyArchives(db: Db): Promise<MonthlyArchive[]> {
  const cached = archivesCache.get();
  if (cached) return cached;

  const sql = `
    SELECT
      CAST(strftime('%Y', published_at, 'unixepoch') AS INTEGER) AS year,
      CAST(strftime('%m', published_at, 'unixepoch') AS INTEGER) AS month,
      COUNT(*) AS count
    FROM posts
    WHERE status = 'published' AND published_at IS NOT NULL
    GROUP BY year, month
    ORDER BY year DESC, month DESC
  `;

  const { results } = await db.query<MonthlyArchive>(sql);
  archivesCache.set(results);
  return results;
}

export async function listPostYears(db: Db): Promise<PostYearCount[]> {
  const { results } = await db.query<PostYearCount>(
    `SELECT CAST(strftime('%Y', created_at, 'unixepoch') AS INTEGER) AS year,
            COUNT(*) AS count
       FROM posts
      GROUP BY year
      ORDER BY year DESC`,
  );
  return results;
}

export async function getAdjacentPosts(
  db: Db,
  publishedAt: number,
  postId: string,
): Promise<AdjacentPosts> {
  const prevSql = `
    SELECT slug, title, published_at
    FROM posts
    WHERE status = 'published'
      AND (published_at < ? OR (published_at = ? AND id < ?))
    ORDER BY published_at DESC, id DESC
    LIMIT 1
  `;

  const nextSql = `
    SELECT slug, title, published_at
    FROM posts
    WHERE status = 'published'
      AND (published_at > ? OR (published_at = ? AND id > ?))
    ORDER BY published_at ASC, id ASC
    LIMIT 1
  `;

  const [prev, next] = await Promise.all([
    db.firstOrNull<AdjacentPost>(prevSql, [publishedAt, publishedAt, postId]),
    db.firstOrNull<AdjacentPost>(nextSql, [publishedAt, publishedAt, postId]),
  ]);

  return { prev, next };
}

/** Get SQLite rowid for a post (needed before FTS delete). */
export async function getPostRowid(
  db: Db,
  id: string,
): Promise<number | null> {
  const row = await db.firstOrNull<{ rowid: number }>(
    "SELECT rowid FROM posts WHERE id = ?",
    [id],
  );
  return row?.rowid ?? null;
}
