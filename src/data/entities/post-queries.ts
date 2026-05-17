// ---------------------------------------------------------------------------
// Post entity — read queries (list, getBySlug, getById)
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { PostWithAgent, PostStatus } from "@/models/types";
import { VIEW_QUERY, type ListPostsOptions, type ListPostsResult } from "./post-types";
import { countCacheGet, countCacheKey, countCacheSet } from "./post-cache";

const DEFAULT_PAGE_SIZE = 20;

/** Build WHERE conditions + parameters from list options. */
function buildListFilters(options: ListPostsOptions): {
  where: string;
  params: unknown[];
} {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.status) {
    conditions.push("p.status = ?");
    params.push(options.status);
  }
  if (options.categoryId) {
    conditions.push("p.category_id = ?");
    params.push(options.categoryId);
  }
  if (options.aiAgentId !== undefined) {
    conditions.push("p.ai_agent_id = ?");
    params.push(options.aiAgentId);
  }
  if (options.tagId) {
    conditions.push("p.id IN (SELECT post_id FROM post_tags WHERE tag_id = ?)");
    params.push(options.tagId);
  }
  if (options.query) {
    conditions.push(
      "(p.title LIKE ? OR p.slug LIKE ? OR p.content LIKE ? OR p.excerpt LIKE ?)",
    );
    const like = `%${options.query}%`;
    params.push(like, like, like, like);
  }
  if (options.archiveYear != null) {
    conditions.push(
      "CAST(strftime('%Y', p.published_at, 'unixepoch') AS INTEGER) = ?",
    );
    params.push(options.archiveYear);
    if (options.archiveMonth != null) {
      conditions.push(
        "CAST(strftime('%m', p.published_at, 'unixepoch') AS INTEGER) = ?",
      );
      params.push(options.archiveMonth);
    }
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

/** Build ORDER BY clause from sort options. */
function buildOrderBy(
  sortBy: NonNullable<ListPostsOptions["sortBy"]>,
  sortOrder: NonNullable<ListPostsOptions["sortOrder"]>,
): string {
  const dir = sortOrder === "asc" ? "ASC" : "DESC";
  const orderMap: Record<string, string> = {
    published_at: `p.published_at ${dir}, p.created_at ${dir}`,
    created_at: `p.created_at ${dir}`,
    comment_count: `p.comment_count ${dir}, p.created_at DESC`,
    view_count: `p.view_count ${dir}, p.created_at DESC`,
    title: `p.title ${dir}`,
  };
  return `ORDER BY ${orderMap[sortBy] ?? orderMap.created_at}`;
}

export async function listPosts(
  db: Db,
  options: ListPostsOptions = {},
): Promise<ListPostsResult> {
  const {
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    sortBy = "published_at",
    sortOrder = "desc",
  } = options;

  const { where, params } = buildListFilters(options);
  const orderBy = buildOrderBy(sortBy, sortOrder);
  const offset = (page - 1) * pageSize;

  const sql = `
    ${VIEW_QUERY}
    ${where}
    ${orderBy}
    LIMIT ? OFFSET ?
  `;

  const result = await db.query<PostWithAgent>(sql, [
    ...params,
    pageSize,
    offset,
  ]);

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

export async function getPostBySlug(
  db: Db,
  slug: string,
  status?: PostStatus,
): Promise<PostWithAgent | null> {
  const conditions = ["p.slug = ?"];
  const params: unknown[] = [slug];

  if (status) {
    conditions.push("p.status = ?");
    params.push(status);
  }

  const sql = `${VIEW_QUERY} WHERE ${conditions.join(" AND ")}`;
  return db.firstOrNull<PostWithAgent>(sql, params);
}

export async function getPostById(
  db: Db,
  id: string,
): Promise<PostWithAgent | null> {
  return db.firstOrNull<PostWithAgent>(
    `${VIEW_QUERY} WHERE p.id = ?`,
    [id],
  );
}
