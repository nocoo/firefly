// ---------------------------------------------------------------------------
// Category Entity — Integration Tests
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach } from "vitest";
import type { Category } from "@/models/types";
import { createCrudHandlers } from "../framework/handlers";
import {
  createMockContext,
  createMockDataLayer,
  parseToolResult,
  expectError,
} from "../framework/test-utils";
import { categoryEntity } from "./category";
import type { ToolContext } from "../framework/types";

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

describe("category entity handlers", () => {
  let ctx: ToolContext;
  let dataLayer: ReturnType<typeof createMockDataLayer<Category>>;
  let handlers: ReturnType<typeof createCrudHandlers<Category>>;

  beforeEach(() => {
    ctx = createMockContext();
    dataLayer = createMockDataLayer<Category>();
    handlers = createCrudHandlers({ ...categoryEntity, dataLayer });
  });

  describe("handleList", () => {
    it("returns all categories", async () => {
      dataLayer.list.mockResolvedValue([sampleCategory]);
      const result = await handlers.handleList(ctx, {});
      const data = parseToolResult(result) as Category[];
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("Tech");
    });
  });

  describe("handleGet", () => {
    it("returns category by slug", async () => {
      dataLayer.getBySlug.mockResolvedValue(sampleCategory);
      const result = await handlers.handleGet(ctx, { slug: "tech" });
      const data = parseToolResult(result) as Category;
      expect(data.name).toBe("Tech");
    });

    it("returns category by id", async () => {
      dataLayer.getById.mockResolvedValue(sampleCategory);
      const result = await handlers.handleGet(ctx, { id: "cat-1" });
      const data = parseToolResult(result) as Category;
      expect(data.id).toBe("cat-1");
    });

    it("returns error for missing category", async () => {
      dataLayer.getBySlug.mockResolvedValue(null);
      const result = await handlers.handleGet(ctx, { slug: "missing" });
      expectError(result, "Category not found: missing");
    });
  });

  describe("handleCreate", () => {
    it("creates category with all fields", async () => {
      dataLayer.create.mockResolvedValue(sampleCategory);
      const result = await handlers.handleCreate(ctx, {
        name: "Tech",
        slug: "tech",
        description: "Technology posts",
        sort_order: 0,
      });
      expect(dataLayer.create).toHaveBeenCalledWith(ctx.db, {
        name: "Tech",
        slug: "tech",
        description: "Technology posts",
        sortOrder: 0,
      });
      const data = parseToolResult(result) as Category;
      expect(data.name).toBe("Tech");
    });
  });

  describe("handleUpdate", () => {
    it("maps new_slug to slug in update input", async () => {
      dataLayer.getBySlug.mockResolvedValue(sampleCategory);
      dataLayer.update.mockResolvedValue({
        ...sampleCategory,
        slug: "technology",
      });

      await handlers.handleUpdate(ctx, {
        slug: "tech",
        new_slug: "technology",
        name: "Technology",
      });

      expect(dataLayer.update).toHaveBeenCalledWith(ctx.db, "cat-1", {
        slug: "technology",
        name: "Technology",
      });
    });

    it("maps sort_order to sortOrder in update input", async () => {
      dataLayer.getById.mockResolvedValue(sampleCategory);
      dataLayer.update.mockResolvedValue({
        ...sampleCategory,
        sort_order: 10,
      });

      await handlers.handleUpdate(ctx, {
        id: "cat-1",
        sort_order: 10,
      });

      expect(dataLayer.update).toHaveBeenCalledWith(ctx.db, "cat-1", {
        sortOrder: 10,
      });
    });

    it("handles nullable description", async () => {
      dataLayer.getById.mockResolvedValue(sampleCategory);
      dataLayer.update.mockResolvedValue({
        ...sampleCategory,
        description: null,
      });

      await handlers.handleUpdate(ctx, {
        id: "cat-1",
        description: null,
      });

      expect(dataLayer.update).toHaveBeenCalledWith(ctx.db, "cat-1", {
        description: null,
      });
    });

    it("returns error for missing category", async () => {
      dataLayer.getBySlug.mockResolvedValue(null);
      const result = await handlers.handleUpdate(ctx, {
        slug: "missing",
        name: "X",
      });
      expectError(result, "Category not found: missing");
    });
  });

  describe("handleDelete", () => {
    it("deletes category by slug", async () => {
      dataLayer.getBySlug.mockResolvedValue(sampleCategory);
      dataLayer.delete.mockResolvedValue(true);
      const result = await handlers.handleDelete(ctx, { slug: "tech" });
      expect(dataLayer.delete).toHaveBeenCalledWith(
        ctx.db,
        "cat-1",
        expect.anything(),
      );
      const data = parseToolResult(result) as { deleted: boolean };
      expect(data.deleted).toBe(true);
    });

    it("returns error for missing category", async () => {
      dataLayer.getBySlug.mockResolvedValue(null);
      const result = await handlers.handleDelete(ctx, { slug: "missing" });
      expectError(result, "Category not found: missing");
    });
  });

  it("uses 'categories' as plural name", () => {
    expect(categoryEntity.plural).toBe("categories");
  });
});
