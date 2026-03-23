import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import type { Tag } from "@/models/types";
import {
  listTags,
  getTagBySlug,
  createTag,
  updateTag,
  deleteTag,
  type CreateTagInput,
  type UpdateTagInput,
} from "./tags";

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

const now = Math.floor(Date.now() / 1000);

const sampleTag: Tag = {
  id: "tag-1",
  name: "TypeScript",
  slug: "typescript",
  post_count: 10,
  created_at: now,
  updated_at: now,
};

// ---------------------------------------------------------------------------
// listTags
// ---------------------------------------------------------------------------

describe("listTags", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns all tags ordered by name", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleTag],
      meta: { changes: 0, duration: 1 },
    });

    const result = await listTags(db);

    expect(db.query).toHaveBeenCalledOnce();
    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("SELECT");
    expect(sql).toContain("ORDER BY");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("TypeScript");
  });
});

// ---------------------------------------------------------------------------
// getTagBySlug
// ---------------------------------------------------------------------------

describe("getTagBySlug", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns tag when found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleTag);

    const result = await getTagBySlug(db, "typescript");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("slug = ?");
    expect(params).toEqual(["typescript"]);
    expect(result?.name).toBe("TypeScript");
  });

  it("returns null when not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    const result = await getTagBySlug(db, "nonexistent");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createTag
// ---------------------------------------------------------------------------

describe("createTag", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("inserts tag and returns it", async () => {
    const input: CreateTagInput = {
      name: "React",
      slug: "react",
    };

    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue({ ...sampleTag, ...input, id: "new-id" });

    const result = await createTag(db, input);

    expect(db.execute).toHaveBeenCalledOnce();
    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("INSERT INTO tags");
    expect(result.name).toBe("React");
  });
});

// ---------------------------------------------------------------------------
// updateTag
// ---------------------------------------------------------------------------

describe("updateTag", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("updates specified fields", async () => {
    const input: UpdateTagInput = { name: "React.js" };

    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });
    vi.mocked(db.firstOrNull).mockResolvedValue({ ...sampleTag, name: "React.js" });

    const result = await updateTag(db, "tag-1", input);

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("UPDATE tags SET");
    expect(sql).toContain("name = ?");
    expect(params).toContain("React.js");
    expect(result?.name).toBe("React.js");
  });

  it("updates slug field", async () => {
    const input: UpdateTagInput = { slug: "reactjs" };

    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });
    vi.mocked(db.firstOrNull).mockResolvedValue({ ...sampleTag, slug: "reactjs" });

    const result = await updateTag(db, "tag-1", input);

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("slug = ?");
    expect(params).toContain("reactjs");
    expect(result?.slug).toBe("reactjs");
  });

  it("returns existing tag when no fields provided", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleTag);

    const result = await updateTag(db, "tag-1", {});

    // Should call getTagById, not execute
    expect(db.execute).not.toHaveBeenCalled();
    expect(db.firstOrNull).toHaveBeenCalledOnce();
    expect(result?.name).toBe("TypeScript");
  });

  it("returns null when not found", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 1 });
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    const result = await updateTag(db, "nonexistent", { name: "X" });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deleteTag
// ---------------------------------------------------------------------------

describe("deleteTag", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("deletes tag and returns true", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    const result = await deleteTag(db, "tag-1");

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("DELETE FROM tags");
    expect(params).toEqual(["tag-1"]);
    expect(result).toBe(true);
  });

  it("returns false when not found", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 1 });
    const result = await deleteTag(db, "nonexistent");
    expect(result).toBe(false);
  });
});
