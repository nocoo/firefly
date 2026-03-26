// ---------------------------------------------------------------------------
// Category Entity — Integration Tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Category } from "@/models/types";
import { createCrudHandlers } from "../framework/handlers";
import { createMockContext, parseToolResult, expectError } from "../framework/test-utils";
import { categoryEntity } from "./category";
import type { ToolContext } from "../framework/types";

// ---------------------------------------------------------------------------
// Mock the data layer
// ---------------------------------------------------------------------------

vi.mock("@/data/categories", () => ({
  listCategories: vi.fn(),
  getCategoryById: vi.fn(),
  getCategoryBySlug: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

import {
  listCategories,
  getCategoryById,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/data/categories";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const now = Math.floor(Date.now() / 1000);

const sampleCategory: Category = {
  id: "cat-1",
  name: "Tech",
  slug: "tech",
  description: "Technology posts",
  sort_order: 0,
  post_count: 5,
  created_at: now,
  updated_at: now,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("category entity handlers", () => {
  let ctx: ToolContext;
  let handlers: ReturnType<typeof createCrudHandlers<Category>>;

  beforeEach(() => {
    ctx = createMockContext();
    handlers = createCrudHandlers(categoryEntity);
    vi.mocked(listCategories).mockReset();
    vi.mocked(getCategoryById).mockReset();
    vi.mocked(getCategoryBySlug).mockReset();
    vi.mocked(createCategory).mockReset();
    vi.mocked(updateCategory).mockReset();
    vi.mocked(deleteCategory).mockReset();
  });

  // ---- list ----

  describe("handleList", () => {
    it("returns all categories", async () => {
      vi.mocked(listCategories).mockResolvedValue([sampleCategory]);
      const result = await handlers.handleList(ctx, {});
      const data = parseToolResult(result) as Category[];
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("Tech");
    });
  });

  // ---- get ----

  describe("handleGet", () => {
    it("returns category by slug", async () => {
      vi.mocked(getCategoryBySlug).mockResolvedValue(sampleCategory);
      const result = await handlers.handleGet(ctx, { slug: "tech" });
      const data = parseToolResult(result) as Category;
      expect(data.name).toBe("Tech");
    });

    it("returns category by id", async () => {
      vi.mocked(getCategoryById).mockResolvedValue(sampleCategory);
      const result = await handlers.handleGet(ctx, { id: "cat-1" });
      const data = parseToolResult(result) as Category;
      expect(data.id).toBe("cat-1");
    });

    it("returns error for missing category", async () => {
      vi.mocked(getCategoryBySlug).mockResolvedValue(null);
      const result = await handlers.handleGet(ctx, { slug: "missing" });
      expectError(result, "Category not found: missing");
    });
  });

  // ---- create ----

  describe("handleCreate", () => {
    it("creates category with all fields", async () => {
      vi.mocked(createCategory).mockResolvedValue(sampleCategory);
      const result = await handlers.handleCreate(ctx, {
        name: "Tech",
        slug: "tech",
        description: "Technology posts",
        sort_order: 0,
      });
      expect(createCategory).toHaveBeenCalledWith(ctx.db, {
        name: "Tech",
        slug: "tech",
        description: "Technology posts",
        sort_order: 0,
      });
      const data = parseToolResult(result) as Category;
      expect(data.name).toBe("Tech");
    });
  });

  // ---- update ----

  describe("handleUpdate", () => {
    it("maps new_slug to slug in update input", async () => {
      vi.mocked(getCategoryBySlug).mockResolvedValue(sampleCategory);
      vi.mocked(updateCategory).mockResolvedValue({
        ...sampleCategory,
        slug: "technology",
      });

      await handlers.handleUpdate(ctx, {
        slug: "tech",
        new_slug: "technology",
        name: "Technology",
      });

      expect(updateCategory).toHaveBeenCalledWith(ctx.db, "cat-1", {
        slug: "technology",
        name: "Technology",
      });
    });

    it("handles nullable description", async () => {
      vi.mocked(getCategoryById).mockResolvedValue(sampleCategory);
      vi.mocked(updateCategory).mockResolvedValue({
        ...sampleCategory,
        description: null,
      });

      await handlers.handleUpdate(ctx, {
        id: "cat-1",
        description: null,
      });

      expect(updateCategory).toHaveBeenCalledWith(ctx.db, "cat-1", {
        description: null,
      });
    });

    it("returns error for missing category", async () => {
      vi.mocked(getCategoryBySlug).mockResolvedValue(null);
      const result = await handlers.handleUpdate(ctx, {
        slug: "missing",
        name: "X",
      });
      expectError(result, "Category not found: missing");
    });
  });

  // ---- delete ----

  describe("handleDelete", () => {
    it("deletes category by slug", async () => {
      vi.mocked(getCategoryBySlug).mockResolvedValue(sampleCategory);
      vi.mocked(deleteCategory).mockResolvedValue(true);
      const result = await handlers.handleDelete(ctx, { slug: "tech" });
      expect(deleteCategory).toHaveBeenCalledWith(ctx.db, "cat-1");
      const data = parseToolResult(result) as { deleted: boolean };
      expect(data.deleted).toBe(true);
    });

    it("returns error for missing category", async () => {
      vi.mocked(getCategoryBySlug).mockResolvedValue(null);
      const result = await handlers.handleDelete(ctx, { slug: "missing" });
      expectError(result, "Category not found: missing");
    });
  });

  // ---- plural naming ----

  it("uses 'categories' as plural name", () => {
    expect(categoryEntity.plural).toBe("categories");
  });
});
