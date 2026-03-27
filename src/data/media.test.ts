import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import {
  listMedia,
  getMedia,
  createMedia,
  deleteMedia,
  listMediaByPost,
  associateMedia,
  batchCreateMedia,
} from "./media";

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

function createMockDb(): Db {
  return {
    query: vi.fn(),
    firstOrNull: vi.fn(),
    execute: vi.fn(),
    batch: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleAttachment = {
  id: "01MEDIA001",
  filename: "photo.jpg",
  r2_key: "uploads/2026/03/photo.jpg",
  mime_type: "image/jpeg",
  size: 12345,
  width: 800,
  height: 600,
  alt_text: null,
  post_id: null,
  wp_id: null,
  created_at: 1774483200,
};

// ---------------------------------------------------------------------------
// createMedia
// ---------------------------------------------------------------------------

describe("createMedia", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("inserts a new attachment and returns the record", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    const result = await createMedia(db, {
      filename: "test.png",
      r2Key: "uploads/2026/03/test.png",
      mimeType: "image/png",
      size: 5000,
    });

    expect(result.id).toBeTruthy();
    expect(result.id.length).toBeGreaterThan(10); // ULID
    expect(result.filename).toBe("test.png");
    expect(result.r2_key).toBe("uploads/2026/03/test.png");
    expect(result.mime_type).toBe("image/png");
    expect(result.size).toBe(5000);
    expect(result.post_id).toBeNull();
    expect(result.wp_id).toBeNull();
    expect(typeof result.created_at).toBe("number");

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("INSERT INTO attachments");
    expect(params).toHaveLength(9);
  });

  it("sets post_id when postId is provided", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    const result = await createMedia(db, {
      filename: "test.png",
      r2Key: "uploads/test.png",
      mimeType: "image/png",
      postId: "post-123",
    });

    expect(result.post_id).toBe("post-123");
    const params = vi.mocked(db.execute).mock.calls[0][1] as unknown[];
    expect(params[7]).toBe("post-123"); // post_id param position
  });

  it("defaults optional fields to null", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    const result = await createMedia(db, {
      filename: "test.png",
      r2Key: "uploads/test.png",
      mimeType: "image/png",
    });

    expect(result.size).toBeNull();
    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
    expect(result.post_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getMedia
// ---------------------------------------------------------------------------

describe("getMedia", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns attachment by id", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleAttachment);

    const result = await getMedia(db, "01MEDIA001");

    expect(result).toEqual(sampleAttachment);
    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("WHERE id = ?");
    expect(params).toEqual(["01MEDIA001"]);
  });

  it("returns null for non-existent id", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    const result = await getMedia(db, "nonexistent");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listMedia
// ---------------------------------------------------------------------------

describe("listMedia", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns paginated list with total count", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 42 });
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleAttachment],
      meta: { changes: 0, duration: 1 },
    });

    const result = await listMedia(db, { page: 1, pageSize: 24 });

    expect(result.total).toBe(42);
    expect(result.media).toHaveLength(1);
    expect(result.media[0]).toEqual(sampleAttachment);

    // Verify ORDER BY and pagination
    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("ORDER BY created_at DESC");
    expect(sql).toContain("LIMIT ? OFFSET ?");
    expect(params).toEqual([24, 0]);
  });

  it("uses default page and pageSize", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 0 });
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    await listMedia(db);

    const params = vi.mocked(db.query).mock.calls[0][1] as unknown[];
    expect(params).toEqual([24, 0]); // default pageSize=24, page=1 → offset=0
  });

  it("calculates correct offset for page 3", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 100 });
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    await listMedia(db, { page: 3, pageSize: 10 });

    const params = vi.mocked(db.query).mock.calls[0][1] as unknown[];
    expect(params).toEqual([10, 20]); // offset = (3-1)*10 = 20
  });

  it("filters by postId when provided", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 5 });
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    await listMedia(db, { postId: "post-123" });

    const [countSql, countParams] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(countSql).toContain("WHERE post_id = ?");
    expect(countParams).toEqual(["post-123"]);

    const [querySql, queryParams] = vi.mocked(db.query).mock.calls[0];
    expect(querySql).toContain("WHERE post_id = ?");
    expect(queryParams).toEqual(["post-123", 24, 0]);
  });

  it("clamps page to minimum 1", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 0 });
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    await listMedia(db, { page: -5 });

    const params = vi.mocked(db.query).mock.calls[0][1] as unknown[];
    expect(params![1]).toBe(0); // offset = (1-1)*24 = 0
  });

  it("filters by search (filename substring)", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 2 });
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    await listMedia(db, { search: "photo" });

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("filename LIKE ?");
    expect(params![0]).toBe("%photo%");
  });

  it("filters by mimeType prefix", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 1 });
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    await listMedia(db, { mimeType: "image/png" });

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("mime_type LIKE ?");
    expect(params![0]).toBe("image/png%");
  });

  it("filters by year with epoch range", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 0 });
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    await listMedia(db, { year: 2026 });

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("created_at >= ? AND created_at < ?");
    // 2026-01-01 to 2027-01-01
    const start = params![0] as number;
    const end = params![1] as number;
    expect(new Date(start * 1000).getFullYear()).toBe(2026);
    expect(new Date(end * 1000).getFullYear()).toBe(2027);
  });

  it("filters by year + month", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 0 });
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    await listMedia(db, { year: 2026, month: 3 });

    const params = vi.mocked(db.query).mock.calls[0][1] as unknown[];
    const start = params![0] as number;
    const end = params![1] as number;
    expect(new Date(start * 1000).getMonth()).toBe(2); // March = index 2
    expect(new Date(end * 1000).getMonth()).toBe(3); // April = index 3
  });

  it("sorts by size ascending", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 0 });
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    await listMedia(db, { sortBy: "size", sortOrder: "asc" });

    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("ORDER BY size ASC");
  });

  it("defaults to created_at DESC when sortBy is invalid", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ cnt: 0 });
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    await listMedia(db, { sortBy: "DROP TABLE" as "created_at" });

    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("ORDER BY created_at DESC");
  });
});

// ---------------------------------------------------------------------------
// listMediaByPost
// ---------------------------------------------------------------------------

describe("listMediaByPost", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns media for a specific post", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleAttachment],
      meta: { changes: 0, duration: 1 },
    });

    const result = await listMediaByPost(db, "post-123");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(sampleAttachment);

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("WHERE post_id = ?");
    expect(sql).toContain("ORDER BY created_at DESC");
    expect(params).toEqual(["post-123"]);
  });
});

// ---------------------------------------------------------------------------
// deleteMedia
// ---------------------------------------------------------------------------

describe("deleteMedia", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("deletes attachment by id", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    await deleteMedia(db, "01MEDIA001");

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("DELETE FROM attachments WHERE id = ?");
    expect(params).toEqual(["01MEDIA001"]);
  });
});

// ---------------------------------------------------------------------------
// associateMedia
// ---------------------------------------------------------------------------

describe("associateMedia", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("updates post_id for orphaned media records", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 2, duration: 1 });

    const count = await associateMedia(db, ["m1", "m2"], "post-123");

    expect(count).toBe(2);
    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("UPDATE attachments SET post_id = ?");
    expect(sql).toContain("WHERE id IN (?, ?)");
    expect(sql).toContain("AND post_id IS NULL");
    expect(params).toEqual(["post-123", "m1", "m2"]);
  });

  it("returns 0 for empty mediaIds array", async () => {
    const count = await associateMedia(db, [], "post-123");
    expect(count).toBe(0);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("builds correct placeholders for single item", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    await associateMedia(db, ["m1"], "post-123");

    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("IN (?)");
  });
});

// ---------------------------------------------------------------------------
// batchCreateMedia
// ---------------------------------------------------------------------------

describe("batchCreateMedia", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("inserts items using db.batch in chunks of 50", async () => {
    vi.mocked(db.batch).mockResolvedValue(
      Array.from({ length: 3 }, () => ({
        results: [],
        meta: { changes: 1, duration: 1 },
      })),
    );

    const items = Array.from({ length: 3 }, (_, i) => ({
      filename: `file-${i}.png`,
      r2Key: `uploads/file-${i}.png`,
      mimeType: "image/png",
      size: 1000,
    }));

    const count = await batchCreateMedia(db, items);

    expect(count).toBe(3);
    expect(db.batch).toHaveBeenCalledTimes(1);

    const statements = vi.mocked(db.batch).mock.calls[0][0];
    expect(statements).toHaveLength(3);
    expect(statements[0].sql).toContain("INSERT OR IGNORE INTO attachments");
  });

  it("batches items in chunks of 50", async () => {
    // Create mock returns for 2 batch calls
    vi.mocked(db.batch)
      .mockResolvedValueOnce(
        Array.from({ length: 50 }, () => ({
          results: [],
          meta: { changes: 1, duration: 1 },
        })),
      )
      .mockResolvedValueOnce(
        Array.from({ length: 10 }, () => ({
          results: [],
          meta: { changes: 1, duration: 1 },
        })),
      );

    const items = Array.from({ length: 60 }, (_, i) => ({
      filename: `file-${i}.png`,
      r2Key: `uploads/file-${i}.png`,
      mimeType: "image/png",
    }));

    const count = await batchCreateMedia(db, items);

    expect(count).toBe(60);
    expect(db.batch).toHaveBeenCalledTimes(2);

    // First batch: 50 items
    expect(vi.mocked(db.batch).mock.calls[0][0]).toHaveLength(50);
    // Second batch: 10 items
    expect(vi.mocked(db.batch).mock.calls[1][0]).toHaveLength(10);
  });

  it("uses INSERT OR IGNORE to skip duplicates", async () => {
    vi.mocked(db.batch).mockResolvedValue([
      { results: [], meta: { changes: 1, duration: 1 } },
      { results: [], meta: { changes: 0, duration: 1 } }, // duplicate skipped
    ]);

    const items = [
      { filename: "a.png", r2Key: "uploads/a.png", mimeType: "image/png" },
      { filename: "b.png", r2Key: "uploads/b.png", mimeType: "image/png" },
    ];

    const count = await batchCreateMedia(db, items);

    expect(count).toBe(1); // only 1 actually inserted
  });

  it("returns 0 for empty items array", async () => {
    const count = await batchCreateMedia(db, []);
    expect(count).toBe(0);
    expect(db.batch).not.toHaveBeenCalled();
  });
});
