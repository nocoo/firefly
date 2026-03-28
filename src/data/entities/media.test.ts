import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import {
  listMedia,
  getMediaById,
  createMedia,
  deleteMedia,
  listMediaByPost,
  associateMedia,
  batchCreateMedia,
  listMediaYears,
} from "./media";
import type { Attachment } from "@/models/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = Math.floor(Date.now() / 1000);

const sampleAttachment: Attachment = {
  id: "att-1",
  filename: "photo.jpg",
  r2_key: "uploads/2026/photo.jpg",
  mime_type: "image/jpeg",
  size: 12345,
  width: 800,
  height: 600,
  alt_text: null,
  post_id: null,
  wp_id: null,
  created_at: now,
};

// ---------------------------------------------------------------------------
// listMedia
// ---------------------------------------------------------------------------

describe("listMedia", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns paginated media with default options", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 1 });
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleAttachment],
      meta: { changes: 0, duration: 1 },
    });

    const result = await listMedia(db);

    expect(result.media).toHaveLength(1);
    expect(result.total).toBe(1);
    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("ORDER BY");
    expect(sql).toContain("LIMIT");
  });

  it("filters by postId", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 0 });
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    await listMedia(db, { postId: "post-1" });

    const [countSql, countParams] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(countSql).toContain("post_id = ?");
    expect(countParams).toContain("post-1");
  });

  it("filters by search", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 0 });
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    await listMedia(db, { search: "photo" });

    const [countSql, countParams] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(countSql).toContain("filename LIKE ?");
    expect(countParams).toContain("%photo%");
  });

  it("filters by mimeType prefix", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 0 });
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    await listMedia(db, { mimeType: "image/" });

    const [countSql, countParams] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(countSql).toContain("mime_type LIKE ?");
    expect(countParams).toContain("image/%");
  });

  it("filters by year", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 0 });
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    await listMedia(db, { year: 2026 });

    const [countSql] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(countSql).toContain("created_at >= ?");
    expect(countSql).toContain("created_at < ?");
  });

  it("filters by year and month", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 0 });
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    await listMedia(db, { year: 2026, month: 3 });

    const [countSql, countParams] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(countSql).toContain("created_at >= ?");
    // March 2026 start epoch
    const marchStart = Math.floor(new Date(2026, 2, 1).getTime() / 1000);
    expect(countParams).toContain(marchStart);
  });

  it("supports custom sort", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 0 });
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    await listMedia(db, { sortBy: "filename", sortOrder: "asc" });

    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("ORDER BY filename ASC");
  });

  it("defaults invalid sortBy to created_at", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 0 });
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    await listMedia(db, { sortBy: "hacked" as "created_at" });

    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("ORDER BY created_at");
  });

  it("clamps pageSize to valid range", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 0 });
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    await listMedia(db, { pageSize: 999 });

    const params = vi.mocked(db.query).mock.calls[0][1]!;
    // Max pageSize should be 250
    expect(params).toContain(250);
  });
});

// ---------------------------------------------------------------------------
// getMediaById
// ---------------------------------------------------------------------------

describe("getMediaById", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns attachment when found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleAttachment);
    const result = await getMediaById(db, "att-1");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("id = ?");
    expect(params).toEqual(["att-1"]);
    expect(result?.filename).toBe("photo.jpg");
  });

  it("returns null when not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    expect(await getMediaById(db, "nope")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createMedia
// ---------------------------------------------------------------------------

describe("createMedia", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("inserts attachment and returns it", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleAttachment);

    const result = await createMedia(db, {
      filename: "photo.jpg",
      r2Key: "uploads/2026/photo.jpg",
      mimeType: "image/jpeg",
      size: 12345,
      width: 800,
      height: 600,
    });

    expect(db.execute).toHaveBeenCalledOnce();
    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("INSERT INTO attachments");
    expect(result.filename).toBe("photo.jpg");
  });

  it("defaults optional fields to null", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleAttachment);

    await createMedia(db, {
      filename: "doc.pdf",
      r2Key: "uploads/doc.pdf",
      mimeType: "application/pdf",
    });

    const params = vi.mocked(db.execute).mock.calls[0][1]!;
    // size, width, height, post_id should be null
    const nullCount = params.filter((p) => p === null).length;
    expect(nullCount).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// deleteMedia
// ---------------------------------------------------------------------------

describe("deleteMedia", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("deletes and returns true", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });
    expect(await deleteMedia(db, "att-1")).toBe(true);

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("DELETE FROM attachments");
    expect(params).toEqual(["att-1"]);
  });

  it("returns false when not found", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 0 });
    expect(await deleteMedia(db, "nope")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listMediaByPost
// ---------------------------------------------------------------------------

describe("listMediaByPost", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns attachments for a post", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleAttachment],
      meta: { changes: 0, duration: 1 },
    });

    const result = await listMediaByPost(db, "post-1");

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("post_id = ?");
    expect(sql).toContain("ORDER BY created_at DESC");
    expect(params).toEqual(["post-1"]);
    expect(result).toHaveLength(1);
  });

  it("returns empty array when none found", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    expect(await listMediaByPost(db, "none")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// associateMedia
// ---------------------------------------------------------------------------

describe("associateMedia", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("updates post_id for specified media", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 2, duration: 3 });

    const count = await associateMedia(db, ["att-1", "att-2"], "post-1");

    expect(count).toBe(2);
    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("UPDATE attachments SET post_id = ?");
    expect(sql).toContain("post_id IS NULL");
    expect(params).toContain("post-1");
    expect(params).toContain("att-1");
    expect(params).toContain("att-2");
  });

  it("returns 0 for empty ids", async () => {
    const count = await associateMedia(db, [], "post-1");
    expect(count).toBe(0);
    expect(db.execute).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// batchCreateMedia
// ---------------------------------------------------------------------------

describe("batchCreateMedia", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("creates media in batches", async () => {
    vi.mocked(db.batch).mockResolvedValue([
      { results: [], meta: { changes: 1, duration: 1 } },
      { results: [], meta: { changes: 1, duration: 1 } },
    ]);

    const count = await batchCreateMedia(db, [
      { filename: "a.jpg", r2Key: "a.jpg", mimeType: "image/jpeg" },
      { filename: "b.jpg", r2Key: "b.jpg", mimeType: "image/jpeg" },
    ]);

    expect(count).toBe(2);
    expect(db.batch).toHaveBeenCalledOnce();
    const stmts = vi.mocked(db.batch).mock.calls[0][0];
    expect(stmts).toHaveLength(2);
    expect(stmts[0].sql).toContain("INSERT OR IGNORE");
  });

  it("returns 0 for empty input", async () => {
    const count = await batchCreateMedia(db, []);
    expect(count).toBe(0);
    expect(db.batch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// listMediaYears
// ---------------------------------------------------------------------------

describe("listMediaYears", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns distinct years with counts", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [
        { year: 2026, count: 10 },
        { year: 2025, count: 5 },
      ],
      meta: { changes: 0, duration: 1 },
    });

    const result = await listMediaYears(db);

    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("strftime");
    expect(sql).toContain("attachments");
    expect(sql).toContain("GROUP BY");
    expect(result).toHaveLength(2);
  });
});
