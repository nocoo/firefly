// ---------------------------------------------------------------------------
// Post entity input/output types (D5: camelCase)
// ---------------------------------------------------------------------------

import type { PostStatus } from "@/models/types";

export interface CreatePostInput {
  title: string;
  slug: string;
  content: string;
  status: PostStatus;
  excerpt?: string | undefined;
  categoryId?: string | undefined;
  aiAgentId?: string | undefined;
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
  aiAgentId?: string | null | undefined;
}

export interface ListPostsOptions {
  status?: PostStatus | undefined;
  categoryId?: string | undefined;
  aiAgentId?: string | undefined;
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
  posts: import("@/models/types").PostWithAgent[];
  total: number;
}

export interface BatchUpdateInput {
  status?: PostStatus | undefined;
  categoryId?: string | null | undefined;
}

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

export interface SearchPostsOptions {
  query: string;
  /** Pass a status to filter, null to search all statuses, or omit for default "published". */
  status?: PostStatus | null | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface SearchResult {
  posts: import("@/models/types").PostWithAgent[];
  snippets: Record<string, string>;
  total: number;
  page: number;
  pageSize: number;
}

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

// Shared view query joining categories + ai_agents (used in list/get/by-slug)
export const VIEW_QUERY = `
  SELECT p.*, c.name AS category_name, c.slug AS category_slug,
         a.name AS agent_name, a.slug AS agent_slug, a.avatar_version AS agent_avatar_version
  FROM posts p
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN ai_agents a ON p.ai_agent_id = a.id
`;
