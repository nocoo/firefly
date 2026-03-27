// ---------------------------------------------------------------------------
// Media data layer — CRUD operations for attachments table
// ---------------------------------------------------------------------------

import type { Db, DbBatchStatement } from "@/lib/db";
import type { Attachment } from "@/models/types";
import { ulid } from "ulid";

export type { Attachment };

// ---------------------------------------------------------------------------
// Input types
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

// ---------------------------------------------------------------------------
// List media (paginated)
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 24;

export async function listMedia(
  db: Db,
  opts: { page?: number; pageSize?: number; postId?: string } = {},
): Promise<{ media: Attachment[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, opts.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.postId) {
    conditions.push("post_id = ?");
    params.push(opts.postId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await db.firstOrNull<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM attachments ${where}`,
    params,
  );
  const total = countResult?.cnt ?? 0;

  const rows = await db.query<Attachment>(
    `SELECT * FROM attachments ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return { media: rows.results, total };
}

// ---------------------------------------------------------------------------
// Get single media
// ---------------------------------------------------------------------------

export async function getMedia(
  db: Db,
  id: string,
): Promise<Attachment | null> {
  return db.firstOrNull<Attachment>(
    "SELECT * FROM attachments WHERE id = ?",
    [id],
  );
}

// ---------------------------------------------------------------------------
// Create media record
// ---------------------------------------------------------------------------

export async function createMedia(
  db: Db,
  input: CreateMediaInput,
): Promise<Attachment> {
  const id = ulid();
  const now = Math.floor(Date.now() / 1000);

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

  return {
    id,
    filename: input.filename,
    r2_key: input.r2Key,
    mime_type: input.mimeType,
    size: input.size ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    alt_text: null,
    post_id: input.postId ?? null,
    wp_id: null,
    created_at: now,
  };
}

// ---------------------------------------------------------------------------
// Delete media record
// ---------------------------------------------------------------------------

export async function deleteMedia(db: Db, id: string): Promise<void> {
  await db.execute("DELETE FROM attachments WHERE id = ?", [id]);
}

// ---------------------------------------------------------------------------
// List media by post
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
// Associate media with post (backfill post_id)
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
// Batch create (for R2 sync script)
// ---------------------------------------------------------------------------

const BATCH_SIZE = 50;

export async function batchCreateMedia(
  db: Db,
  items: Array<Omit<CreateMediaInput, "postId">>,
): Promise<number> {
  let inserted = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);

    const statements: DbBatchStatement[] = chunk.map((item) => ({
      sql: `INSERT OR IGNORE INTO attachments (id, filename, r2_key, mime_type, size, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [
        ulid(),
        item.filename,
        item.r2Key,
        item.mimeType,
        item.size ?? null,
        Math.floor(Date.now() / 1000),
      ],
    }));

    const results = await db.batch(statements);
    inserted += results.reduce((sum, r) => sum + (r.meta?.changes ?? 0), 0);
  }

  return inserted;
}
