import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import {
  listCategories,
  getCategoryBySlug,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  listCategoriesWithPostStats,
  invalidateCategoryCache,
} from "./category";
import type { Category } from "@/models/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = Math.floor(Date.now() / 1000);

const sampleCategory: Category = {
  id: "cat-1",
  name: "Tech",
  slug: "tech",
  description: "Technology articles",
  sort_order: 10,
  post_count: 5,
  created_at: now,
  updated_at: now,
};

// ---------------------------------------------------------------------------
// listCategories
// ---------------------------------------------------------------------------

describe("listCategories", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
    invalidateCategoryCache();
  });

  it("returns all categories ordered by sort_order DESC, name ASC", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleCategory],
      meta: { changes: 0, duration: 1 },
    });

    const result = await listCategories(db);

    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("ORDER BY");
    expect(sql).toContain("sort_order DESC");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Tech");
  });

  it("caches results on first call", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleCategory],
      meta: { changes: 0, duration: 1 },
    });

    await listCategories(db);
    await listCategories(db);
    expect(db.query).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// getCategoryBySlug
// ---------------------------------------------------------------------------

describe("getCategoryBySlug", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns category when found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleCategory);
    const result = await getCategoryBySlug(db, "tech");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("slug = ?");
    expect(params).toEqual(["tech"]);
    expect(result?.name).toBe("Tech");
  });

  it("returns null when not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    expect(await getCategoryBySlug(db, "nope")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getCategoryById
// ---------------------------------------------------------------------------

describe("getCategoryById", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns category when found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleCategory);
    const result = await getCategoryById(db, "cat-1");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("id = ?");
    expect(params).toEqual(["cat-1"]);
    expect(result?.name).toBe("Tech");
  });
});

// ---------------------------------------------------------------------------
// createCategory
// ---------------------------------------------------------------------------

describe("createCategory", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("inserts category and returns it", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleCategory);

    const result = await createCategory(db, {
      name: "Tech",
      slug: "tech",
      description: "Technology articles",
      sortOrder: 10,
    });

    expect(db.execute).toHaveBeenCalledOnce();
    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("INSERT INTO categories");
    expect(result.name).toBe("Tech");
  });

  it("defaults sortOrder to 1 when not provided", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleCategory);

    await createCategory(db, { name: "Tech", slug: "tech" });

    const params = vi.mocked(db.execute).mock.calls[0][1]!;
    // params: [id, name, slug, description, sort_order, created_at, updated_at]
    expect(params[4]).toBe(1); // sort_order default
  });

  it("invalidates cache after creation", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleCategory],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleCategory);

    await listCategories(db);
    await createCategory(db, { name: "New", slug: "new" });
    await listCategories(db);

    expect(db.query).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// updateCategory
// ---------------------------------------------------------------------------

describe("updateCategory", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("updates specified fields", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ ...sampleCategory, name: "Updated" });
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    const result = await updateCategory(db, "cat-1", { name: "Updated" });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("UPDATE categories SET");
    expect(params).toContain("Updated");
    expect(result?.name).toBe("Updated");
  });

  it("updates sortOrder with correct column mapping", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updateCategory(db, "cat-1", { sortOrder: 5 });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("sort_order = ?");
    expect(params).toContain(5);
  });

  it("returns existing when no fields provided", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleCategory);
    const result = await updateCategory(db, "cat-1", {});
    expect(db.execute).not.toHaveBeenCalled();
    expect(result?.name).toBe("Tech");
  });

  it("sets description to null when null is passed", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updateCategory(db, "cat-1", { description: null });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("description = ?");
    expect(params).toContain(null);
  });
});

// ---------------------------------------------------------------------------
// deleteCategory
// ---------------------------------------------------------------------------

describe("deleteCategory", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("deletes and returns true", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });
    expect(await deleteCategory(db, "cat-1")).toBe(true);

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("DELETE FROM categories");
    expect(params).toEqual(["cat-1"]);
  });

  it("returns false when not found", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 0 });
    expect(await deleteCategory(db, "nope")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// reorderCategories
// ---------------------------------------------------------------------------

describe("reorderCategories", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("updates sort_order for all ids in batch", async () => {
    vi.mocked(db.batch).mockResolvedValue([
      { results: [], meta: { changes: 1, duration: 1 } },
      { results: [], meta: { changes: 1, duration: 1 } },
      { results: [], meta: { changes: 1, duration: 1 } },
    ]);

    await reorderCategories(db, ["a", "b", "c"]);

    expect(db.batch).toHaveBeenCalledOnce();
    const stmts = vi.mocked(db.batch).mock.calls[0][0];
    expect(stmts).toHaveLength(3);
    // First id gets highest sort_order (3)
    expect(stmts[0].params![0]).toBe(3); // sort_order for "a"
    expect(stmts[0].params![2]).toBe("a"); // id
    expect(stmts[2].params![0]).toBe(1); // sort_order for "c"
  });

  it("is a no-op for empty array", async () => {
    await reorderCategories(db, []);
    expect(db.batch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// listCategoriesWithPostStats
// ---------------------------------------------------------------------------

describe("listCategoriesWithPostStats", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns categories enriched with post counts", async () => {
    const enriched = {
      ...sampleCategory,
      total_posts: 10,
      published_posts: 8,
      draft_posts: 2,
    };
    vi.mocked(db.query).mockResolvedValue({
      results: [enriched],
      meta: { changes: 0, duration: 1 },
    });

    const result = await listCategoriesWithPostStats(db);

    expect(db.query).toHaveBeenCalledOnce();
    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("LEFT JOIN posts");
    expect(sql).toContain("GROUP BY");
    expect(result[0].total_posts).toBe(10);
  });
});
