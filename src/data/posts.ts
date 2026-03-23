// ---------------------------------------------------------------------------
// Post data layer — CRUD operations against D1 via Worker proxy
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { Post, PostWithCategory, PostStatus } from "@/models/types";
import { readingTime, excerptFromContent } from "@/models/post";
import { ulid } from "ulid";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreatePostInput {
  title: string;
  slug: string;
  content: string;
  status: PostStatus;
  excerpt?: string | undefined;
  category_id?: string | undefined;
  featured_image?: string | undefined;
  comment_enabled?: number | undefined;
  published_at?: number | undefined;
}

export interface UpdatePostInput {
  title?: string | undefined;
  slug?: string | undefined;
  content?: string | undefined;
  excerpt?: string | undefined;
  status?: PostStatus | undefined;
  category_id?: string | null | undefined;
  featured_image?: string | null | undefined;
  comment_enabled?: number | undefined;
  published_at?: number | null | undefined;
}

export interface ListPostsOptions {
  status?: PostStatus | undefined;
  categoryId?: string | undefined;
  tagId?: string | undefined;
  query?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface ListPostsResult {
  posts: PostWithCategory[];
  total: number;
}

// ---------------------------------------------------------------------------
// listPosts
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 20;

export async function listPosts(
  db: Db,
  options: ListPostsOptions = {},
): Promise<ListPostsResult> {
  const {
    status,
    categoryId,
    tagId,
    query,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) {
    conditions.push("p.status = ?");
    params.push(status);
  }

  if (categoryId) {
    conditions.push("p.category_id = ?");
    params.push(categoryId);
  }

  if (tagId) {
    conditions.push(
      "p.id IN (SELECT post_id FROM post_tags WHERE tag_id = ?)",
    );
    params.push(tagId);
  }

  if (query) {
    conditions.push("p.title LIKE ?");
    params.push(`%${query}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * pageSize;

  const sql = `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM posts p
    LEFT JOIN categories c ON p.category_id = c.id
    ${where}
    ORDER BY p.published_at DESC, p.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const result = await db.query<PostWithCategory>(sql, [
    ...params,
    pageSize,
    offset,
  ]);

  // Separate COUNT query for accurate pagination total
  const countSql = `SELECT COUNT(*) AS count FROM posts p ${where}`;
  const countResult = await db.firstOrNull<{ count: number }>(
    countSql,
    params,
  );

  return {
    posts: result.results,
    total: countResult?.count ?? result.results.length,
  };
}

// ---------------------------------------------------------------------------
// getPostBySlug
// ---------------------------------------------------------------------------

export async function getPostBySlug(
  db: Db,
  slug: string,
  /** When set, only returns posts with this status (use for public access). */
  status?: PostStatus,
): Promise<PostWithCategory | null> {
  const conditions = ["p.slug = ?"];
  const params: unknown[] = [slug];

  if (status) {
    conditions.push("p.status = ?");
    params.push(status);
  }

  const sql = `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM posts p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE ${conditions.join(" AND ")}
  `;

  return db.firstOrNull<PostWithCategory>(sql, params);
}

// ---------------------------------------------------------------------------
// getPostById
// ---------------------------------------------------------------------------

export async function getPostById(
  db: Db,
  id: string,
): Promise<PostWithCategory | null> {
  const sql = `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM posts p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `;

  return db.firstOrNull<PostWithCategory>(sql, [id]);
}

// ---------------------------------------------------------------------------
// createPost
// ---------------------------------------------------------------------------

export async function createPost(
  db: Db,
  input: CreatePostInput,
): Promise<Post> {
  const id = ulid();
  const now = Math.floor(Date.now() / 1000);

  const computedReadingTime = readingTime(input.content);
  const computedExcerpt = input.excerpt ?? excerptFromContent(input.content);

  // Set published_at if publishing and not explicitly provided
  const publishedAt =
    input.published_at ??
    (input.status === "published" ? now : null);

  const sql = `
    INSERT INTO posts (
      id, title, slug, content, excerpt, status,
      category_id, featured_image, comment_enabled,
      reading_time, published_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await db.execute(sql, [
    id,
    input.title,
    input.slug,
    input.content,
    computedExcerpt,
    input.status,
    input.category_id ?? null,
    input.featured_image ?? null,
    input.comment_enabled ?? 0,
    computedReadingTime,
    publishedAt,
    now,
    now,
  ]);

  const post = await getPostById(db, id);

  // Refresh category post_count if the new post has a category
  if (input.category_id) {
    await refreshCategoryPostCount(db, input.category_id);
  }

  return post!;
}

// ---------------------------------------------------------------------------
// updatePost
// ---------------------------------------------------------------------------

export async function updatePost(
  db: Db,
  id: string,
  input: UpdatePostInput,
): Promise<PostWithCategory | null> {
  // Fetch existing post to track category/status changes
  const existingPost = await getPostById(db, id);
  if (!existingPost) return null;

  const setClauses: string[] = [];
  const params: unknown[] = [];

  if (input.title !== undefined) {
    setClauses.push("title = ?");
    params.push(input.title);
  }

  if (input.slug !== undefined) {
    setClauses.push("slug = ?");
    params.push(input.slug);
  }

  if (input.content !== undefined) {
    setClauses.push("content = ?");
    params.push(input.content);

    // Recompute reading time and excerpt when content changes
    setClauses.push("reading_time = ?");
    params.push(readingTime(input.content));

    if (input.excerpt === undefined) {
      setClauses.push("excerpt = ?");
      params.push(excerptFromContent(input.content));
    }
  }

  if (input.excerpt !== undefined) {
    setClauses.push("excerpt = ?");
    params.push(input.excerpt);
  }

  if (input.status !== undefined) {
    setClauses.push("status = ?");
    params.push(input.status);
  }

  if (input.category_id !== undefined) {
    setClauses.push("category_id = ?");
    params.push(input.category_id);
  }

  if (input.featured_image !== undefined) {
    setClauses.push("featured_image = ?");
    params.push(input.featured_image);
  }

  if (input.comment_enabled !== undefined) {
    setClauses.push("comment_enabled = ?");
    params.push(input.comment_enabled);
  }

  if (input.published_at !== undefined) {
    setClauses.push("published_at = ?");
    params.push(input.published_at);
  }

  // Auto-set published_at when transitioning to published without explicit date
  if (
    input.status === "published" &&
    input.published_at === undefined
  ) {
    if (!existingPost.published_at) {
      setClauses.push("published_at = ?");
      params.push(Math.floor(Date.now() / 1000));
    }
  }

  if (setClauses.length === 0) return getPostById(db, id);

  // Always update updated_at
  setClauses.push("updated_at = ?");
  params.push(Math.floor(Date.now() / 1000));

  params.push(id);

  const sql = `UPDATE posts SET ${setClauses.join(", ")} WHERE id = ?`;
  await db.execute(sql, params);

  // Refresh category post_count if category or status changed
  const categoryChanged = input.category_id !== undefined && input.category_id !== existingPost.category_id;
  const statusChanged = input.status !== undefined && input.status !== existingPost.status;

  if (categoryChanged || statusChanged) {
    // Refresh old category
    await refreshCategoryPostCount(db, existingPost.category_id);
    // Refresh new category (may be the same if only status changed)
    const newCategoryId = input.category_id !== undefined ? input.category_id : existingPost.category_id;
    if (newCategoryId !== existingPost.category_id) {
      await refreshCategoryPostCount(db, newCategoryId);
    }
  }

  // Refresh all tag counts if status changed (published ↔ non-published affects counts)
  if (statusChanged) {
    await refreshAllTagPostCounts(db);
  }

  return getPostById(db, id);
}

// ---------------------------------------------------------------------------
// deletePost
// ---------------------------------------------------------------------------

export async function deletePost(db: Db, id: string): Promise<boolean> {
  // Fetch post before deletion to know which category/tags to refresh
  const post = await getPostById(db, id);

  const meta = await db.execute("DELETE FROM posts WHERE id = ?", [id]);
  if (meta.changes === 0) return false;

  // Refresh category and tag counts after deletion
  if (post?.category_id) {
    await refreshCategoryPostCount(db, post.category_id);
  }
  await refreshAllTagPostCounts(db);

  return true;
}

// ---------------------------------------------------------------------------
// getPostTags — get tags for a post
// ---------------------------------------------------------------------------

export async function getPostTags(
  db: Db,
  postId: string,
): Promise<{ id: string; name: string; slug: string }[]> {
  const sql = `
    SELECT t.id, t.name, t.slug
    FROM tags t
    INNER JOIN post_tags pt ON pt.tag_id = t.id
    WHERE pt.post_id = ?
    ORDER BY t.name
  `;
  const result = await db.query<{ id: string; name: string; slug: string }>(
    sql,
    [postId],
  );
  return result.results;
}

// ---------------------------------------------------------------------------
// setPostTags — replace all tags for a post (atomic via batch)
// ---------------------------------------------------------------------------

export async function setPostTags(
  db: Db,
  postId: string,
  tagIds: string[],
): Promise<void> {
  const statements = [
    { sql: "DELETE FROM post_tags WHERE post_id = ?", params: [postId] as unknown[] },
    ...tagIds.map((tagId) => ({
      sql: "INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)",
      params: [postId, tagId] as unknown[],
    })),
  ];

  if (statements.length > 1) {
    await db.batch(statements);
  } else {
    // Only delete (no tags to add)
    await db.execute(statements[0].sql, statements[0].params);
  }

  // Refresh post_count for all affected tags
  await refreshAllTagPostCounts(db);
}

// ---------------------------------------------------------------------------
// Post count maintenance helpers
// ---------------------------------------------------------------------------

/**
 * Refresh post_count for a specific category by counting published posts.
 * Pass null to refresh the "no category" case (no-op).
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

/**
 * Refresh post_count for ALL tags from ground truth.
 * Uses a single UPDATE ... subquery to avoid N+1.
 */
export async function refreshAllTagPostCounts(db: Db): Promise<void> {
  await db.execute(
    `UPDATE tags SET post_count = (
      SELECT COUNT(*) FROM post_tags pt
      INNER JOIN posts p ON p.id = pt.post_id AND p.status = 'published'
      WHERE pt.tag_id = tags.id
    )`,
  );
}

// ---------------------------------------------------------------------------
// Monthly archives
// ---------------------------------------------------------------------------

export interface MonthlyArchive {
  year: number;
  month: number;
  count: number;
}

/**
 * Group published posts by year/month, newest first.
 */
export async function listMonthlyArchives(
  db: Db,
): Promise<MonthlyArchive[]> {
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
  return results;
}
