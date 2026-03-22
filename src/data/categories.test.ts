import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import type { Category } from "@/models/types";
import {
  listCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "./categories";

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

const sampleCategory: Category = {
  id: "cat-1",
  name: "Technology",
  slug: "technology",
  description: "Tech posts",
  sort_order: 0,
  post_count: 5,
  created_at: now,
  updated_at: now,
};

// ---------------------------------------------------------------------------
// listCategories
// ---------------------------------------------------------------------------

describe("listCategories", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns all categories ordered by sort_order", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleCategory],
      meta: { changes: 0, duration: 1 },
    });

    const result = await listCategories(db);

    expect(db.query).toHaveBeenCalledOnce();
    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("SELECT");
    expect(sql).toContain("ORDER BY");
    expect(sql).toContain("sort_order");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Technology");
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

    const result = await getCategoryBySlug(db, "technology");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("slug = ?");
    expect(params).toEqual(["technology"]);
    expect(result?.name).toBe("Technology");
  });

  it("returns null when not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    const result = await getCategoryBySlug(db, "nonexistent");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createCategory
// ---------------------------------------------------------------------------

describe("createCategory", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("inserts category and returns it", async () => {
    const input: CreateCategoryInput = {
      name: "Design",
      slug: "design",
      description: "Design posts",
    };

    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue({ ...sampleCategory, ...input, id: "new-id" });

    const result = await createCategory(db, input);

    expect(db.execute).toHaveBeenCalledOnce();
    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("INSERT INTO categories");
    expect(result.name).toBe("Design");
  });

  it("handles optional fields", async () => {
    const input: CreateCategoryInput = {
      name: "Misc",
      slug: "misc",
    };

    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue({ ...sampleCategory, ...input });

    await createCategory(db, input);

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("description");
    // description should be null
    expect(params).toContain(null);
  });
});

// ---------------------------------------------------------------------------
// updateCategory
// ---------------------------------------------------------------------------

describe("updateCategory", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("updates specified fields", async () => {
    const input: UpdateCategoryInput = { name: "Tech & Science" };

    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });
    vi.mocked(db.firstOrNull).mockResolvedValue({ ...sampleCategory, name: "Tech & Science" });

    const result = await updateCategory(db, "cat-1", input);

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("UPDATE categories SET");
    expect(sql).toContain("name = ?");
    expect(params).toContain("Tech & Science");
    expect(result?.name).toBe("Tech & Science");
  });

  it("returns null when not found", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 1 });
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    const result = await updateCategory(db, "nonexistent", { name: "X" });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deleteCategory
// ---------------------------------------------------------------------------

describe("deleteCategory", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("deletes category and returns true", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    const result = await deleteCategory(db, "cat-1");

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("DELETE FROM categories");
    expect(params).toEqual(["cat-1"]);
    expect(result).toBe(true);
  });

  it("returns false when not found", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 1 });
    const result = await deleteCategory(db, "nonexistent");
    expect(result).toBe(false);
  });
});
