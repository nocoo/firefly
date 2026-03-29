// ---------------------------------------------------------------------------
// Post entity — pure CRUD + aggregation primitives (D4: no cross-entity side effects)
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { PostWithCategory, PostStatus } from "@/models/types";
import { readingTime, excerptFromContent } from "@/models/post";
import { renderMarkdown } from "@/models/markdown";
import { createCache } from "@/lib/cache";
import { nowEpoch, newId } from "@/data/core/timestamps";

// ---------------------------------------------------------------------------
// View query (D2)
// ---------------------------------------------------------------------------

const VIEW_QUERY = `
  SELECT p.*, c.name AS category_name, c.slug AS category_slug
  FROM posts p
  LEFT JOIN categories c ON p.category_id = c.id
`;

// ---------------------------------------------------------------------------
// Input types (D5: camelCase)
// ---------------------------------------------------------------------------

export interface CreatePostInput {
  title: string;
  slug: string;
  content: string;
  status: PostStatus;
  excerpt?: string | undefined;
  categoryId?: string | undefined;
  featuredImage?: string | undefined;
  commentEnabled?: number | undefined;
  publishedAt?: number | undefined;
  referenceUrl?: string | undefined;
  referenceTitle?: string | undefined;
  referenceDescription?: string | undefined;
  referenceImage?: string | undefined;
}

export interface UpdatePostInput {
  title?: string | undefined;
  slug?: string | undefined;
  content?: string | undefined;
  /** Pass null to clear and auto-regenerate from content. */
  excerpt?: string | null | undefined;
  status?: PostStatus | undefined;
  categoryId?: string | null | undefined;
  featuredImage?: string | null | undefined;
  commentEnabled?: number | undefined;
  publishedAt?: number | null | undefined;
  referenceUrl?: string | null | undefined;
  referenceTitle?: string | null | undefined;
  referenceDescription?: string | null | undefined;
  referenceImage?: string | null | undefined;
}

export interface ListPostsOptions {
  status?: PostStatus | undefined;
  categoryId?: string | undefined;
  tagId?: string | undefined;
  query?: string | undefined;
  archiveYear?: number | undefined;
  archiveMonth?: number | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
  sortBy?: "published_at" | "created_at" | "comment_count" | "view_count" | "title" | undefined;
  sortOrder?: "asc" | "desc" | undefined;
}

export interface ListPostsResult {
  posts: PostWithCategory[];
  total: number;
}

export interface BatchUpdateInput {
  status?: PostStatus | undefined;
  categoryId?: string | null | undefined;
}

// ---------------------------------------------------------------------------
// Aggregation types
// ---------------------------------------------------------------------------

export interface MonthlyArchive {
  year: number;
  month: number;
  count: number;
}

export interface PostYearCount {
  year: number;
  count: number;
}

export interface AdjacentPost {
  slug: string;
  title: string;
  published_at: number;
}

export interface AdjacentPosts {
  prev: AdjacentPost | null;
  next: AdjacentPost | null;
}

// ---------------------------------------------------------------------------
// Caches
// ---------------------------------------------------------------------------

const COUNT_TTL = 5 * 60 * 1000;
const COUNT_MAX_SIZE = 64;

interface CountEntry {
  value: number;
  cachedAt: number;
}

const countCache = new Map<string, CountEntry>();

function countCacheKey(where: string, params: unknown[]): string {
  return `${where}|${JSON.stringify(params)}`;
}

/** Get a count cache entry, evicting it if expired. */
function countCacheGet(key: string): CountEntry | undefined {
  const entry = countCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt >= COUNT_TTL) {
    countCache.delete(key);
    return undefined;
  }
  return entry;
}

/** Set a count cache entry, evicting oldest entries when at capacity. */
function countCacheSet(key: string, entry: CountEntry): void {
  // Delete first so re-insert moves it to the end (Map insertion order)
  countCache.delete(key);
  if (countCache.size >= COUNT_MAX_SIZE) {
    // Evict oldest entry (first in insertion order)
    const oldest = countCache.keys().next().value;
    if (oldest !== undefined) countCache.delete(oldest);
  }
  countCache.set(key, entry);
}

const archivesCache = createCache<MonthlyArchive[]>(5 * 60 * 1000);

/** Force all post caches to expire (count + archives). */
export function invalidatePostCaches(): void {
  countCache.clear();
  archivesCache.invalidate();
}

// ---------------------------------------------------------------------------
// listPosts — complex paginated list with filters
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
    archiveYear,
    archiveMonth,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    sortBy = "published_at",
    sortOrder = "desc",
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

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * pageSize;

  const dir = sortOrder === "asc" ? "ASC" : "DESC";
  const orderMap: Record<string, string> = {
    published_at: `p.published_at ${dir}, p.created_at ${dir}`,
    created_at: `p.created_at ${dir}`,
    comment_count: `p.comment_count ${dir}, p.created_at DESC`,
    view_count: `p.view_count ${dir}, p.created_at DESC`,
    title: `p.title ${dir}`,
  };
  const orderBy = `ORDER BY ${orderMap[sortBy] ?? orderMap.created_at}`;

  const sql = `
    ${VIEW_QUERY}
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
  const cachedCount = countCacheGet(cacheKey);
  let total: number;

  if (cachedCount) {
    total = cachedCount.value;
  } else {
    const countResult = await db.firstOrNull<{ count: number }>(
      countSql,
      params,
    );
    total = countResult?.count ?? result.results.length;
    countCacheSet(cacheKey, { value: total, cachedAt: Date.now() });
  }

  return { posts: result.results, total };
}

// ---------------------------------------------------------------------------
// getPostBySlug
// ---------------------------------------------------------------------------

export async function getPostBySlug(
  db: Db,
  slug: string,
  status?: PostStatus,
): Promise<PostWithCategory | null> {
  const conditions = ["p.slug = ?"];
  const params: unknown[] = [slug];

  if (status) {
    conditions.push("p.status = ?");
    params.push(status);
  }

  const sql = `${VIEW_QUERY} WHERE ${conditions.join(" AND ")}`;
  return db.firstOrNull<PostWithCategory>(sql, params);
}

// ---------------------------------------------------------------------------
// getPostById
// ---------------------------------------------------------------------------

export async function getPostById(
  db: Db,
  id: string,
): Promise<PostWithCategory | null> {
  return db.firstOrNull<PostWithCategory>(
    `${VIEW_QUERY} WHERE p.id = ?`,
    [id],
  );
}

// ---------------------------------------------------------------------------
// createPost
// ---------------------------------------------------------------------------

export async function createPost(
  db: Db,
  input: CreatePostInput,
): Promise<PostWithCategory> {
  const id = newId();
  const now = nowEpoch();

  const computedReadingTime = readingTime(input.content);
  const computedExcerpt = input.excerpt ?? excerptFromContent(input.content);
  const contentHtml = renderMarkdown(input.content);

  // Set published_at if publishing and not explicitly provided
  const publishedAt =
    input.publishedAt ?? (input.status === "published" ? now : null);

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
    input.categoryId ?? null,
    input.featuredImage ?? null,
    input.commentEnabled ?? 0,
    computedReadingTime,
    publishedAt,
    input.referenceUrl ?? null,
    input.referenceTitle ?? null,
    input.referenceDescription ?? null,
    input.referenceImage ?? null,
    now,
    now,
  ]);

  const post = await getPostById(db, id);
  if (!post) throw new Error(`Failed to retrieve Post ${id} after creation`);
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
  const existing = await getPostById(db, id);
  if (!existing) return null;

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
      const contentForExcerpt = input.content ?? existing.content;
      params.push(excerptFromContent(contentForExcerpt));
    } else {
      params.push(input.excerpt);
    }
  }

  if (input.status !== undefined) {
    setClauses.push("status = ?");
    params.push(input.status);
  }

  if (input.categoryId !== undefined) {
    setClauses.push("category_id = ?");
    params.push(input.categoryId);
  }

  if (input.featuredImage !== undefined) {
    setClauses.push("featured_image = ?");
    params.push(input.featuredImage);
  }

  if (input.referenceUrl !== undefined) {
    setClauses.push("reference_url = ?");
    params.push(input.referenceUrl);
  }

  // Defense-in-depth: clear orphan reference metadata when referenceUrl is null
  if (input.referenceUrl === null) {
    if (input.referenceTitle === undefined) {
      setClauses.push("reference_title = ?");
      params.push(null);
    }
    if (input.referenceDescription === undefined) {
      setClauses.push("reference_description = ?");
      params.push(null);
    }
    if (input.referenceImage === undefined) {
      setClauses.push("reference_image = ?");
      params.push(null);
    }
  }

  if (input.referenceTitle !== undefined) {
    setClauses.push("reference_title = ?");
    params.push(input.referenceTitle);
  }

  if (input.referenceDescription !== undefined) {
    setClauses.push("reference_description = ?");
    params.push(input.referenceDescription);
  }

  if (input.referenceImage !== undefined) {
    setClauses.push("reference_image = ?");
    params.push(input.referenceImage);
  }

  if (input.commentEnabled !== undefined) {
    setClauses.push("comment_enabled = ?");
    params.push(input.commentEnabled);
  }

  if (input.publishedAt !== undefined) {
    setClauses.push("published_at = ?");
    params.push(input.publishedAt);
  }

  // Auto-set published_at when transitioning to published without explicit date
  if (
    input.status === "published" &&
    input.publishedAt === undefined
  ) {
    if (!existing.published_at) {
      setClauses.push("published_at = ?");
      params.push(nowEpoch());
    }
  }

  if (setClauses.length === 0) return getPostById(db, id);

  setClauses.push("updated_at = ?");
  params.push(nowEpoch());

  params.push(id);

  const sql = `UPDATE posts SET ${setClauses.join(", ")} WHERE id = ?`;
  await db.execute(sql, params);

  return getPostById(db, id);
}

// ---------------------------------------------------------------------------
// deletePost (D4: no cross-entity side effects)
// ---------------------------------------------------------------------------

export async function deletePost(db: Db, id: string): Promise<boolean> {
  const meta = await db.execute("DELETE FROM posts WHERE id = ?", [id]);
  return meta.changes > 0;
}

// ---------------------------------------------------------------------------
// getPostTags — tags for a post
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
// setPostTags — replace all tags for a post (D4: pure batch, NO count refresh)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// batchUpdatePosts (D4: pure, NO side effects)
// ---------------------------------------------------------------------------

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

  if (input.categoryId !== undefined) {
    setClauses.push("category_id = ?");
    params.push(input.categoryId);
  }

  if (setClauses.length === 0) return 0;

  setClauses.push("updated_at = ?");
  params.push(nowEpoch());

  if (input.status === "published") {
    setClauses.push("published_at = COALESCE(published_at, ?)");
    params.push(nowEpoch());
  }

  const placeholders = ids.map(() => "?").join(", ");
  params.push(...ids);

  const sql = `UPDATE posts SET ${setClauses.join(", ")} WHERE id IN (${placeholders})`;
  const result = await db.execute(sql, params);

  return result.changes;
}

// ---------------------------------------------------------------------------
// Count maintenance (pure primitives — D4)
// ---------------------------------------------------------------------------

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

/**
 * Refresh post_count for ALL categories from ground truth.
 */
export async function refreshAllCategoryPostCounts(db: Db): Promise<void> {
  await db.execute(
    `UPDATE categories SET post_count = (
      SELECT COUNT(*) FROM posts
      WHERE posts.category_id = categories.id AND posts.status = 'published'
    )`,
  );
}

/**
 * Refresh post_count for ALL tags from ground truth.
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
// listMonthlyArchives (cached)
// ---------------------------------------------------------------------------

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
// listPostYears
// ---------------------------------------------------------------------------

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
// getAdjacentPosts
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// getPostRowid — get SQLite rowid for a post (needed before FTS delete)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// FTS search — full-text search via Worker endpoint
// ---------------------------------------------------------------------------

export interface SearchPostsOptions {
  query: string;
  status?: PostStatus;
  page?: number;
  pageSize?: number;
}

export interface SearchResult {
  posts: PostWithCategory[];
  snippets: Record<string, string>;
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Full-text search via the Worker's FTS5 endpoint.
 * Returns ranked results with highlighted snippets.
 */
export async function searchPosts(
  db: Db,
  options: SearchPostsOptions,
): Promise<SearchResult> {
  const { query, status = "published", page = 1, pageSize = 20 } = options;

  return db.call<SearchResult>("/api/v1/fts-search", {
    query,
    status,
    page,
    pageSize,
  });
}

// ---------------------------------------------------------------------------
// FTS sync helper — called by PostService
// ---------------------------------------------------------------------------

export interface FtsSyncUpsert {
  action: "upsert";
  postId: string;
  title: string;
  content: string;
  excerpt?: string | undefined;
}

export interface FtsSyncDelete {
  action: "delete";
  rowid: number;
}

export type FtsSyncInput = FtsSyncUpsert | FtsSyncDelete;

/**
 * Sync a single post to/from the FTS index via the Worker endpoint.
 */
export async function ftsSync(
  db: Db,
  input: FtsSyncInput,
): Promise<void> {
  await db.call("/api/v1/fts-sync", input);
}

