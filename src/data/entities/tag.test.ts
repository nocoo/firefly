import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import {
  listTags,
  getTagBySlug,
  getTagById,
  createTag,
  updateTag,
  deleteTag,
  invalidateTagCache,
} from "./tag";
import type { Tag } from "@/models/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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
  beforeEach(() => {
    db = createMockDb();
    invalidateTagCache();
  });

  it("returns all tags ordered by name", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleTag],
      meta: { changes: 0, duration: 1 },
    });

    const result = await listTags(db);

    expect(db.query).toHaveBeenCalledOnce();
    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("SELECT");
    expect(sql).toContain("ORDER BY name ASC");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("TypeScript");
  });

  it("caches results on first call", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleTag],
      meta: { changes: 0, duration: 1 },
    });

    await listTags(db);
    await listTags(db);

    expect(db.query).toHaveBeenCalledOnce();
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
// getTagById
// ---------------------------------------------------------------------------

describe("getTagById", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns tag when found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleTag);

    const result = await getTagById(db, "tag-1");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("id = ?");
    expect(params).toEqual(["tag-1"]);
    expect(result?.name).toBe("TypeScript");
  });

  it("returns null when not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    const result = await getTagById(db, "nonexistent");
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
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue({ ...sampleTag, id: "new-id" });

    const result = await createTag(db, { name: "React", slug: "react" });

    expect(db.execute).toHaveBeenCalledOnce();
    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("INSERT INTO tags");
    expect(result.name).toBe("TypeScript");
  });

  it("generates id and timestamps", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleTag);

    await createTag(db, { name: "React", slug: "react" });

    const params = vi.mocked(db.execute).mock.calls[0][1]!;
    expect(typeof params[0]).toBe("string"); // id (ULID)
    expect(params[1]).toBe("React");         // name
    expect(params[2]).toBe("react");         // slug
    expect(typeof params[3]).toBe("number"); // created_at
    expect(typeof params[4]).toBe("number"); // updated_at
  });

  it("invalidates cache after creation", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleTag],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleTag);

    // Populate cache
    await listTags(db);
    expect(db.query).toHaveBeenCalledOnce();

    // Create new tag
    await createTag(db, { name: "New", slug: "new" });

    // Next listTags should re-query
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleTag, { ...sampleTag, name: "New", slug: "new" }],
      meta: { changes: 0, duration: 1 },
    });
    await listTags(db);
    expect(db.query).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// updateTag
// ---------------------------------------------------------------------------

describe("updateTag", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("updates specified fields", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ ...sampleTag, name: "React.js" });
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    const result = await updateTag(db, "tag-1", { name: "React.js" });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("UPDATE tags SET");
    expect(sql).toContain("name = ?");
    expect(params).toContain("React.js");
    expect(result?.name).toBe("React.js");
  });

  it("updates slug field", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ ...sampleTag, slug: "reactjs" });
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    const result = await updateTag(db, "tag-1", { slug: "reactjs" });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("slug = ?");
    expect(params).toContain("reactjs");
    expect(result?.slug).toBe("reactjs");
  });

  it("returns existing tag when no fields provided", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleTag);

    const result = await updateTag(db, "tag-1", {});

    expect(db.execute).not.toHaveBeenCalled();
    expect(result?.name).toBe("TypeScript");
  });

  it("invalidates cache after update", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleTag);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleTag],
      meta: { changes: 0, duration: 1 },
    });

    // Populate cache
    await listTags(db);

    // Update
    await updateTag(db, "tag-1", { name: "Updated" });

    // Next listTags should re-query
    await listTags(db);
    expect(db.query).toHaveBeenCalledTimes(2);
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

  it("invalidates cache after deletion", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    // Populate cache
    await listTags(db);

    // Delete
    await deleteTag(db, "tag-1");

    // Next listTags should re-query
    await listTags(db);
    expect(db.query).toHaveBeenCalledTimes(2);
  });
});
