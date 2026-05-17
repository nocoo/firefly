// ---------------------------------------------------------------------------
// Post entity — FTS search + sync (via Worker endpoints)
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type {
  FtsSyncInput,
  SearchPostsOptions,
  SearchResult,
} from "./post-types";

/** Clamp a page/pageSize value to a safe positive integer. */
function sanitizePage(
  value: number | undefined,
  fallback: number,
  max?: number,
): number {
  const n = value ?? fallback;
  if (!Number.isFinite(n) || n < 1) return fallback;
  const clamped = Math.floor(n);
  return max ? Math.min(clamped, max) : clamped;
}

/**
 * Full-text search via the Worker's FTS5 endpoint.
 * Returns ranked results with highlighted snippets.
 */
export async function searchPosts(
  db: Db,
  options: SearchPostsOptions,
): Promise<SearchResult> {
  // null = all statuses (admin search), undefined = default "published" (public search)
  const status =
    options.status === null ? null : (options.status ?? "published");

  const page = sanitizePage(options.page, 1);
  const pageSize = sanitizePage(options.pageSize, 20, 100);

  const body: Record<string, unknown> = {
    query: options.query,
    page,
    pageSize,
  };
  if (status) body.status = status;

  return db.call<SearchResult>("/api/v1/fts-search", body);
}

/** Sync a single post to/from the FTS index via the Worker endpoint. */
export async function ftsSync(db: Db, input: FtsSyncInput): Promise<void> {
  await db.call("/api/v1/fts-sync", input);
}
