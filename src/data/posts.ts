// ---------------------------------------------------------------------------
// Post data layer — CRUD operations against D1 via Worker proxy
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { Post, PostWithCategory, PostStatus } from "@/models/types";
import { readingTime, excerptFromContent } from "@/models/post";
import { renderMarkdown } from "@/models/markdown";
import { createCache } from "@/lib/cache";
import { invalidateCategoriesCache } from "./categories";
import { invalidateTagCache } from "@/data/entities/tag";
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
  reference_url?: string | undefined;
  reference_title?: string | undefined;
  reference_description?: string | undefined;
  reference_image?: string | undefined;
}

export interface UpdatePostInput {
  title?: string | undefined;
  slug?: string | undefined;
  content?: string | undefined;
  /** Pass null to clear and auto-regenerate from content. */
  excerpt?: string | null | undefined;
  status?: PostStatus | undefined;
  category_id?: string | null | undefined;
  featured_image?: string | null | undefined;
  comment_enabled?: number | undefined;
  published_at?: number | null | undefined;
  reference_url?: string | null | undefined;
  reference_title?: string | null | undefined;
  reference_description?: string | null | undefined;
  reference_image?: string | null | undefined;
}

export interface ListPostsOptions {
  status?: PostStatus | undefined;
  categoryId?: string | undefined;
  tagId?: string | undefined;
  query?: string | undefined;
  /** Filter by archive year (e.g. 2026) */
  archiveYear?: number | undefined;
  /** Filter by archive month (1-12). Only used when archiveYear is set. */
  archiveMonth?: number | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
  /** Column to sort by. Default: "published_at". */
  sortBy?: "published_at" | "created_at" | undefined;
}

export interface ListPostsResult {
  posts: PostWithCategory[];
  total: number;
}

// ---------------------------------------------------------------------------
// listPosts
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Post count cache — keyed by WHERE clause, 5 min TTL
// ---------------------------------------------------------------------------

const COUNT_TTL = 5 * 60 * 1000;

interface CountEntry {
  value: number;
  cachedAt: number;
}

const countCache = new Map<string, CountEntry>();

function countCacheKey(where: string, params: unknown[]): string {
  return `${where}|${JSON.stringify(params)}`;
}

/** Force all cached count entries to expire. */
export function invalidateCountCache(): void {
  countCache.clear();
}

export async function listPosts(
  db: Db,
  options: ListPostsOptions = {},
): Promise<ListPostsResult> {
  const {
    status,
    categoryId,
    tagId,
    query,
    archiveYear,
    archiveMonth,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    sortBy = "published_at",
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
    conditions.push(
      "(p.title LIKE ? OR p.slug LIKE ? OR p.content LIKE ? OR p.excerpt LIKE ?)",
    );
    const like = `%${query}%`;
    params.push(like, like, like, like);
  }

  if (archiveYear != null) {
    conditions.push(
      "CAST(strftime('%Y', p.published_at, 'unixepoch') AS INTEGER) = ?",
    );
    params.push(archiveYear);
    if (archiveMonth != null) {
      conditions.push(
        "CAST(strftime('%m', p.published_at, 'unixepoch') AS INTEGER) = ?",
      );
      params.push(archiveMonth);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * pageSize;

  const orderBy =
    sortBy === "created_at"
      ? "ORDER BY p.created_at DESC"
      : "ORDER BY p.published_at DESC, p.created_at DESC";

  const sql = `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM posts p
    LEFT JOIN categories c ON p.category_id = c.id
    ${where}
    ${orderBy}
    LIMIT ? OFFSET ?
  `;

  const result = await db.query<PostWithCategory>(sql, [
    ...params,
    pageSize,
    offset,
  ]);

  // Separate COUNT query for accurate pagination total (cached)
  const countSql = `SELECT COUNT(*) AS count FROM posts p ${where}`;
  const cacheKey = countCacheKey(where, params);
  const cachedCount = countCache.get(cacheKey);
  let total: number;

  if (cachedCount && Date.now() - cachedCount.cachedAt < COUNT_TTL) {
    total = cachedCount.value;
  } else {
    const countResult = await db.firstOrNull<{ count: number }>(
      countSql,
      params,
    );
    total = countResult?.count ?? result.results.length;
    countCache.set(cacheKey, { value: total, cachedAt: Date.now() });
  }

  return {
    posts: result.results,
    total,
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
  const contentHtml = renderMarkdown(input.content);

  // Set published_at if publishing and not explicitly provided
  const publishedAt =
    input.published_at ??
    (input.status === "published" ? now : null);

  const sql = `
    INSERT INTO posts (
      id, title, slug, content, content_html, excerpt, status,
      category_id, featured_image, comment_enabled,
      reading_time, published_at,
      reference_url, reference_title, reference_description, reference_image,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await db.execute(sql, [
    id,
    input.title,
    input.slug,
    input.content,
    contentHtml,
    computedExcerpt,
    input.status,
    input.category_id ?? null,
    input.featured_image ?? null,
    input.comment_enabled ?? 0,
    computedReadingTime,
    publishedAt,
    input.reference_url ?? null,
    input.reference_title ?? null,
    input.reference_description ?? null,
    input.reference_image ?? null,
    now,
    now,
  ]);

  const post = await getPostById(db, id);

  // Refresh category post_count if the new post has a category
  if (input.category_id) {
    await refreshCategoryPostCount(db, input.category_id);
  }

  // Published post changes archive counts
  if (input.status === "published") {
    invalidateArchivesCache();
  }

  invalidateCountCache();
  if (!post) throw new Error(`Failed to retrieve post ${id} after creation`);
  return post;
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

    // Recompute reading time, excerpt, and pre-rendered HTML when content changes
    setClauses.push("reading_time = ?");
    params.push(readingTime(input.content));

    setClauses.push("content_html = ?");
    params.push(renderMarkdown(input.content));

    if (input.excerpt === undefined) {
      setClauses.push("excerpt = ?");
      params.push(excerptFromContent(input.content));
    }
  }

  if (input.excerpt !== undefined) {
    setClauses.push("excerpt = ?");
    if (input.excerpt === null) {
      // null means "clear and auto-regenerate from content"
      const contentForExcerpt = input.content ?? existingPost.content;
      params.push(excerptFromContent(contentForExcerpt));
    } else {
      params.push(input.excerpt);
    }
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

  if (input.reference_url !== undefined) {
    setClauses.push("reference_url = ?");
    params.push(input.reference_url);
  }

  // Defense-in-depth: when reference_url is explicitly cleared, also clear
  // orphan metadata fields that weren't explicitly set by the caller.
  if (input.reference_url === null) {
    if (input.reference_title === undefined) {
      setClauses.push("reference_title = ?");
      params.push(null);
    }
    if (input.reference_description === undefined) {
      setClauses.push("reference_description = ?");
      params.push(null);
    }
    if (input.reference_image === undefined) {
      setClauses.push("reference_image = ?");
      params.push(null);
    }
  }

  if (input.reference_title !== undefined) {
    setClauses.push("reference_title = ?");
    params.push(input.reference_title);
  }

  if (input.reference_description !== undefined) {
    setClauses.push("reference_description = ?");
    params.push(input.reference_description);
  }

  if (input.reference_image !== undefined) {
    setClauses.push("reference_image = ?");
    params.push(input.reference_image);
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
    invalidateArchivesCache();
  }

  invalidateCountCache();
  return getPostById(db, id);
}

// ---------------------------------------------------------------------------
// batchUpdatePosts — update status and/or category for multiple posts
// ---------------------------------------------------------------------------

export interface BatchUpdateInput {
  status?: PostStatus | undefined;
  category_id?: string | null | undefined;
}

export async function batchUpdatePosts(
  db: Db,
  ids: string[],
  input: BatchUpdateInput,
): Promise<number> {
  if (ids.length === 0) return 0;

  const setClauses: string[] = [];
  const params: unknown[] = [];

  if (input.status !== undefined) {
    setClauses.push("status = ?");
    params.push(input.status);
  }

  if (input.category_id !== undefined) {
    setClauses.push("category_id = ?");
    params.push(input.category_id);
  }

  if (setClauses.length === 0) return 0;

  // Always bump updated_at
  setClauses.push("updated_at = ?");
  params.push(Math.floor(Date.now() / 1000));

  // Auto-set published_at for posts transitioning to published
  if (input.status === "published") {
    setClauses.push("published_at = COALESCE(published_at, ?)");
    params.push(Math.floor(Date.now() / 1000));
  }

  const placeholders = ids.map(() => "?").join(", ");
  params.push(...ids);

  const sql = `UPDATE posts SET ${setClauses.join(", ")} WHERE id IN (${placeholders})`;
  const result = await db.execute(sql, params);

  // Refresh caches — category and tag counts may have changed
  if (input.category_id !== undefined || input.status !== undefined) {
    // Broad invalidation since multiple posts may span categories
    invalidateCategoriesCache();
    await refreshAllTagPostCounts(db);
    invalidateArchivesCache();
  }
  invalidateCountCache();

  return result.changes;
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
  invalidateArchivesCache();
  invalidateCountCache();

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
  invalidateCategoriesCache();
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
  invalidateTagCache();
}

// ---------------------------------------------------------------------------
// Monthly archives
// ---------------------------------------------------------------------------

const archivesCache = createCache<MonthlyArchive[]>(5 * 60 * 1000);

/** Force next `listMonthlyArchives` call to re-fetch from DB. */
export function invalidateArchivesCache(): void {
  archivesCache.invalidate();
}

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

// ---------------------------------------------------------------------------
// Post year counts (for admin filter dropdown)
// ---------------------------------------------------------------------------

export interface PostYearCount {
  year: number;
  count: number;
}

/**
 * Return distinct years that contain posts, ordered descending, with counts.
 * Uses `created_at` (not `published_at`) so drafts are included in admin view.
 */
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

// ---------------------------------------------------------------------------
// Adjacent posts (prev / next) for keyboard navigation
// ---------------------------------------------------------------------------

export interface AdjacentPost {
  slug: string;
  title: string;
  published_at: number;
}

export interface AdjacentPosts {
  prev: AdjacentPost | null;
  next: AdjacentPost | null;
}

/**
 * Get the previous and next published posts relative to the given post.
 * Ordered by published_at DESC (blog order).
 * - prev = the post published immediately BEFORE (older) the current one
 * - next = the post published immediately AFTER (newer) the current one
 */
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
