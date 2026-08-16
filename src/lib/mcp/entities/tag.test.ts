// ---------------------------------------------------------------------------
// Tag Entity — Integration Tests
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach } from "vitest";
import type { Tag } from "@/models/types";
import { createCrudHandlers } from "../framework/handlers";
import {
  createMockContext,
  createMockDataLayer,
  parseToolResult,
  expectError,
} from "../framework/test-utils";
import { tagEntity } from "./tag";
import type { ToolContext } from "../framework/types";

const now = Math.floor(Date.now() / 1000);

const sampleTag: Tag = {
  id: "tag-1",
  name: "JavaScript",
  slug: "javascript",
  post_count: 10,
  created_at: now,
  updated_at: now,
};

describe("tag entity handlers", () => {
  let ctx: ToolContext;
  let dataLayer: ReturnType<typeof createMockDataLayer<Tag>>;
  let handlers: ReturnType<typeof createCrudHandlers<Tag>>;

  beforeEach(() => {
    ctx = createMockContext();
    dataLayer = createMockDataLayer<Tag>();
    handlers = createCrudHandlers({ ...tagEntity, dataLayer });
  });

  describe("handleList", () => {
    it("returns all tags", async () => {
      dataLayer.list.mockResolvedValue([sampleTag]);
      const result = await handlers.handleList(ctx, {});
      const data = parseToolResult(result) as Tag[];
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("JavaScript");
    });
  });

  describe("handleGet", () => {
    it("returns tag by slug", async () => {
      dataLayer.getBySlug.mockResolvedValue(sampleTag);
      const result = await handlers.handleGet(ctx, { slug: "javascript" });
      const data = parseToolResult(result) as Tag;
      expect(data.name).toBe("JavaScript");
    });

    it("returns tag by id", async () => {
      dataLayer.getById.mockResolvedValue(sampleTag);
      const result = await handlers.handleGet(ctx, { id: "tag-1" });
      const data = parseToolResult(result) as Tag;
      expect(data.id).toBe("tag-1");
    });

    it("returns error for missing tag", async () => {
      dataLayer.getBySlug.mockResolvedValue(null);
      const result = await handlers.handleGet(ctx, { slug: "missing" });
      expectError(result, "Tag not found: missing");
    });

    it("returns error when both id and slug provided", async () => {
      const result = await handlers.handleGet(ctx, {
        id: "tag-1",
        slug: "javascript",
      });
      expectError(result, "Provide either id or slug, not both");
    });
  });

  describe("handleCreate", () => {
    it("creates tag and returns it", async () => {
      dataLayer.create.mockResolvedValue(sampleTag);
      const result = await handlers.handleCreate(ctx, {
        name: "JavaScript",
        slug: "javascript",
      });
      expect(dataLayer.create).toHaveBeenCalledWith(ctx.db, {
        name: "JavaScript",
        slug: "javascript",
      });
      const data = parseToolResult(result) as Tag;
      expect(data.name).toBe("JavaScript");
    });
  });

  describe("handleUpdate", () => {
    it("maps new_slug to slug in update input", async () => {
      dataLayer.getBySlug.mockResolvedValue(sampleTag);
      dataLayer.update.mockResolvedValue({
        ...sampleTag,
        slug: "js",
      });

      const result = await handlers.handleUpdate(ctx, {
        slug: "javascript",
        new_slug: "js",
        name: "JS",
      });

      expect(dataLayer.update).toHaveBeenCalledWith(ctx.db, "tag-1", {
        slug: "js",
        name: "JS",
      });
      expect(result.isError).toBeUndefined();
    });

    it("handles update without new_slug", async () => {
      dataLayer.getById.mockResolvedValue(sampleTag);
      dataLayer.update.mockResolvedValue({
        ...sampleTag,
        name: "TypeScript",
      });

      await handlers.handleUpdate(ctx, { id: "tag-1", name: "TypeScript" });
      expect(dataLayer.update).toHaveBeenCalledWith(ctx.db, "tag-1", {
        name: "TypeScript",
      });
    });

    it("returns error for missing tag", async () => {
      dataLayer.getBySlug.mockResolvedValue(null);
      const result = await handlers.handleUpdate(ctx, {
        slug: "missing",
        name: "X",
      });
      expectError(result, "Tag not found: missing");
    });
  });

  describe("handleDelete", () => {
    it("deletes tag by slug", async () => {
      dataLayer.getBySlug.mockResolvedValue(sampleTag);
      dataLayer.delete.mockResolvedValue(true);

      const result = await handlers.handleDelete(ctx, { slug: "javascript" });
      expect(dataLayer.delete).toHaveBeenCalledWith(
        ctx.db,
        "tag-1",
        expect.anything(),
      );
      const data = parseToolResult(result) as { deleted: boolean };
      expect(data.deleted).toBe(true);
    });

    it("deletes tag by id", async () => {
      dataLayer.getById.mockResolvedValue(sampleTag);
      dataLayer.delete.mockResolvedValue(true);

      const result = await handlers.handleDelete(ctx, { id: "tag-1" });
      expect(dataLayer.delete).toHaveBeenCalledWith(
        ctx.db,
        "tag-1",
        expect.anything(),
      );
      const data = parseToolResult(result) as { deleted: boolean };
      expect(data.deleted).toBe(true);
    });

    it("returns error for missing tag", async () => {
      dataLayer.getBySlug.mockResolvedValue(null);
      const result = await handlers.handleDelete(ctx, { slug: "missing" });
      expectError(result, "Tag not found: missing");
    });
  });
});
