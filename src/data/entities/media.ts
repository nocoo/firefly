// ---------------------------------------------------------------------------
// Media entity — CRUD + batch operations for attachments
// No updated_at column; no caching (media is always paginated)
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { Attachment } from "@/models/types";
import { nowEpoch, newId } from "@/data/core/timestamps";

// ---------------------------------------------------------------------------
// Input types (D5: camelCase)
// ---------------------------------------------------------------------------

export interface CreateMediaInput {
  filename: string;
  r2Key: string;
  mimeType: string;
  size?: number;
  width?: number;
  height?: number;
  postId?: string;
}

export interface ListMediaOptions {
  page?: number;
  pageSize?: number;
  postId?: string;
  /** Substring match against filename */
  search?: string;
  /** MIME type prefix, e.g. "image/png" or "image/" */
  mimeType?: string;
  /** Filter by year (of created_at) */
  year?: number;
  /** Filter by month 1-12 (requires year) */
  month?: number;
  /** Column to order by */
  sortBy?: "created_at" | "size" | "filename";
  /** Sort direction */
  sortOrder?: "asc" | "desc";
}

export interface ListMediaResult {
  media: Attachment[];
  total: number;
}

export interface YearCount {
  year: number;
  count: number;
}

// ---------------------------------------------------------------------------
// listMedia — paginated with filters
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 250;
const ALLOWED_SORT_COLUMNS = ["created_at", "size", "filename"] as const;
type AllowedSort = (typeof ALLOWED_SORT_COLUMNS)[number];

export async function listMedia(
  db: Db,
  opts: ListMediaOptions = {},
): Promise<ListMediaResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, opts.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.postId) {
    conditions.push("post_id = ?");
    params.push(opts.postId);
  }

  if (opts.search) {
    conditions.push("filename LIKE ?");
    params.push(`%${opts.search}%`);
  }

  if (opts.mimeType) {
    conditions.push("mime_type LIKE ?");
    params.push(`${opts.mimeType}%`);
  }

  if (opts.year) {
    const startMonth = opts.month ?? 1;
    const endMonth = opts.month ?? 12;
    const start = Math.floor(
      new Date(opts.year, startMonth - 1, 1).getTime() / 1000,
    );
    const end = Math.floor(
      new Date(
        endMonth === 12 ? opts.year + 1 : opts.year,
        endMonth === 12 ? 0 : endMonth,
        1,
      ).getTime() / 1000,
    );
    conditions.push("created_at >= ? AND created_at < ?");
    params.push(start, end);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Validate sort column
  const sortBy: AllowedSort = ALLOWED_SORT_COLUMNS.includes(
    opts.sortBy as AllowedSort,
  )
    ? (opts.sortBy as AllowedSort)
    : "created_at";
  const sortOrder = opts.sortOrder === "asc" ? "ASC" : "DESC";

  const countResult = await db.firstOrNull<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM attachments ${where}`,
    params,
  );
  const total = countResult?.cnt ?? 0;

  const rows = await db.query<Attachment>(
    `SELECT * FROM attachments ${where} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return { media: rows.results, total };
}

// ---------------------------------------------------------------------------
// getMediaById
// ---------------------------------------------------------------------------

export async function getMediaById(
  db: Db,
  id: string,
): Promise<Attachment | null> {
  return db.firstOrNull<Attachment>(
    "SELECT * FROM attachments WHERE id = ?",
    [id],
  );
}

// ---------------------------------------------------------------------------
// createMedia
// ---------------------------------------------------------------------------

export async function createMedia(
  db: Db,
  input: CreateMediaInput,
): Promise<Attachment> {
  const id = newId();
  const now = nowEpoch();

  await db.execute(
    `INSERT INTO attachments (id, filename, r2_key, mime_type, size, width, height, post_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.filename,
      input.r2Key,
      input.mimeType,
      input.size ?? null,
      input.width ?? null,
      input.height ?? null,
      input.postId ?? null,
      now,
    ],
  );

  const attachment = await getMediaById(db, id);
  if (!attachment) {
    throw new Error(`Failed to retrieve Attachment ${id} after creation`);
  }
  return attachment;
}

// ---------------------------------------------------------------------------
// deleteMedia
// ---------------------------------------------------------------------------

export async function deleteMedia(db: Db, id: string): Promise<boolean> {
  const meta = await db.execute(
    "DELETE FROM attachments WHERE id = ?",
    [id],
  );
  return meta.changes > 0;
}

// ---------------------------------------------------------------------------
// listMediaByPost
// ---------------------------------------------------------------------------

export async function listMediaByPost(
  db: Db,
  postId: string,
): Promise<Attachment[]> {
  const result = await db.query<Attachment>(
    "SELECT * FROM attachments WHERE post_id = ? ORDER BY created_at DESC",
    [postId],
  );
  return result.results;
}

// ---------------------------------------------------------------------------
// associateMedia — backfill post_id for unlinked media
// ---------------------------------------------------------------------------

export async function associateMedia(
  db: Db,
  mediaIds: string[],
  postId: string,
): Promise<number> {
  if (mediaIds.length === 0) return 0;

  const placeholders = mediaIds.map(() => "?").join(", ");
  const result = await db.execute(
    `UPDATE attachments SET post_id = ? WHERE id IN (${placeholders}) AND post_id IS NULL`,
    [postId, ...mediaIds],
  );
  return result.changes;
}

// ---------------------------------------------------------------------------
// batchCreateMedia — for R2 sync script
// ---------------------------------------------------------------------------

const BATCH_SIZE = 50;

export async function batchCreateMedia(
  db: Db,
  items: Array<Omit<CreateMediaInput, "postId">>,
): Promise<number> {
  if (items.length === 0) return 0;

  let inserted = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);

    const statements = chunk.map((item) => ({
      sql: `INSERT OR IGNORE INTO attachments (id, filename, r2_key, mime_type, size, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [
        newId(),
        item.filename,
        item.r2Key,
        item.mimeType,
        item.size ?? null,
        nowEpoch(),
      ] as unknown[],
    }));

    const results = await db.batch(statements);
    inserted += results.reduce(
      (sum, r) => sum + (r.meta?.changes ?? 0),
      0,
    );
  }

  return inserted;
}

// ---------------------------------------------------------------------------
// listMediaYears
// ---------------------------------------------------------------------------

export async function listMediaYears(db: Db): Promise<YearCount[]> {
  const rows = await db.query<YearCount>(
    `SELECT CAST(strftime('%Y', created_at, 'unixepoch') AS INTEGER) AS year,
            COUNT(*) AS count
       FROM attachments
      GROUP BY year
      ORDER BY year DESC`,
  );
  return rows.results;
}
