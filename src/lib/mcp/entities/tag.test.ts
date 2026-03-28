// ---------------------------------------------------------------------------
// Tag Entity — Integration Tests
// Tests tag entity config wired through the framework with mocked data layer.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Tag } from "@/models/types";
import { createCrudHandlers } from "../framework/handlers";
import { createMockContext, parseToolResult, expectError } from "../framework/test-utils";
import { tagEntity } from "./tag";
import type { ToolContext } from "../framework/types";

// ---------------------------------------------------------------------------
// Mock the data layer
// ---------------------------------------------------------------------------

vi.mock("@/data/entities/tag", () => ({
  listTags: vi.fn(),
  getTagById: vi.fn(),
  getTagBySlug: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}));

import {
  listTags,
  getTagById,
  getTagBySlug,
  createTag,
  updateTag,
  deleteTag,
} from "@/data/entities/tag";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const now = Math.floor(Date.now() / 1000);

const sampleTag: Tag = {
  id: "tag-1",
  name: "JavaScript",
  slug: "javascript",
  post_count: 10,
  created_at: now,
  updated_at: now,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("tag entity handlers", () => {
  let ctx: ToolContext;
  let handlers: ReturnType<typeof createCrudHandlers<Tag>>;

  beforeEach(() => {
    ctx = createMockContext();
    handlers = createCrudHandlers(tagEntity);
    vi.mocked(listTags).mockReset();
    vi.mocked(getTagById).mockReset();
    vi.mocked(getTagBySlug).mockReset();
    vi.mocked(createTag).mockReset();
    vi.mocked(updateTag).mockReset();
    vi.mocked(deleteTag).mockReset();
  });

  // ---- list ----

  describe("handleList", () => {
    it("returns all tags", async () => {
      vi.mocked(listTags).mockResolvedValue([sampleTag]);
      const result = await handlers.handleList(ctx, {});
      const data = parseToolResult(result) as Tag[];
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("JavaScript");
    });
  });

  // ---- get ----

  describe("handleGet", () => {
    it("returns tag by slug", async () => {
      vi.mocked(getTagBySlug).mockResolvedValue(sampleTag);
      const result = await handlers.handleGet(ctx, { slug: "javascript" });
      const data = parseToolResult(result) as Tag;
      expect(data.name).toBe("JavaScript");
    });

    it("returns tag by id", async () => {
      vi.mocked(getTagById).mockResolvedValue(sampleTag);
      const result = await handlers.handleGet(ctx, { id: "tag-1" });
      const data = parseToolResult(result) as Tag;
      expect(data.id).toBe("tag-1");
    });

    it("returns error for missing tag", async () => {
      vi.mocked(getTagBySlug).mockResolvedValue(null);
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

  // ---- create ----

  describe("handleCreate", () => {
    it("creates tag and returns it", async () => {
      vi.mocked(createTag).mockResolvedValue(sampleTag);
      const result = await handlers.handleCreate(ctx, {
        name: "JavaScript",
        slug: "javascript",
      });
      expect(createTag).toHaveBeenCalledWith(ctx.db, {
        name: "JavaScript",
        slug: "javascript",
      });
      const data = parseToolResult(result) as Tag;
      expect(data.name).toBe("JavaScript");
    });
  });

  // ---- update ----

  describe("handleUpdate", () => {
    it("maps new_slug to slug in update input", async () => {
      vi.mocked(getTagBySlug).mockResolvedValue(sampleTag);
      vi.mocked(updateTag).mockResolvedValue({
        ...sampleTag,
        slug: "js",
      });

      const result = await handlers.handleUpdate(ctx, {
        slug: "javascript",
        new_slug: "js",
        name: "JS",
      });

      // mapUpdateInput should have converted new_slug → slug
      expect(updateTag).toHaveBeenCalledWith(ctx.db, "tag-1", {
        slug: "js",
        name: "JS",
      });
      expect(result.isError).toBeUndefined();
    });

    it("handles update without new_slug", async () => {
      vi.mocked(getTagById).mockResolvedValue(sampleTag);
      vi.mocked(updateTag).mockResolvedValue({
        ...sampleTag,
        name: "TypeScript",
      });

      await handlers.handleUpdate(ctx, { id: "tag-1", name: "TypeScript" });
      expect(updateTag).toHaveBeenCalledWith(ctx.db, "tag-1", {
        name: "TypeScript",
      });
    });

    it("returns error for missing tag", async () => {
      vi.mocked(getTagBySlug).mockResolvedValue(null);
      const result = await handlers.handleUpdate(ctx, {
        slug: "missing",
        name: "X",
      });
      expectError(result, "Tag not found: missing");
    });
  });

  // ---- delete ----

  describe("handleDelete", () => {
    it("deletes tag by slug", async () => {
      vi.mocked(getTagBySlug).mockResolvedValue(sampleTag);
      vi.mocked(deleteTag).mockResolvedValue(true);

      const result = await handlers.handleDelete(ctx, { slug: "javascript" });
      expect(deleteTag).toHaveBeenCalledWith(ctx.db, "tag-1");
      const data = parseToolResult(result) as { deleted: boolean };
      expect(data.deleted).toBe(true);
    });

    it("deletes tag by id", async () => {
      vi.mocked(getTagById).mockResolvedValue(sampleTag);
      vi.mocked(deleteTag).mockResolvedValue(true);

      const result = await handlers.handleDelete(ctx, { id: "tag-1" });
      expect(deleteTag).toHaveBeenCalledWith(ctx.db, "tag-1");
      const data = parseToolResult(result) as { deleted: boolean };
      expect(data.deleted).toBe(true);
    });

    it("returns error for missing tag", async () => {
      vi.mocked(getTagBySlug).mockResolvedValue(null);
      const result = await handlers.handleDelete(ctx, { slug: "missing" });
      expectError(result, "Tag not found: missing");
    });
  });
});
