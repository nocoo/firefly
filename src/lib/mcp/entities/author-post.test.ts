import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import type { PostWithAgent, AiAgent } from "@/models/types";
import { createMockPostWithAgent } from "@/data/core/test-utils";
import { createAuthorPostEntity } from "./author-post";

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock("@/data/entities/post", () => ({
  listPosts: vi.fn(),
  getPostById: vi.fn(),
  getPostBySlug: vi.fn(),
  getPostTags: vi.fn(),
}));

vi.mock("@/data/entities/ai-agent", () => ({
  getAiAgentById: vi.fn(),
}));

vi.mock("@/services/post-service", () => ({
  PostService: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { listPosts, getPostById, getPostBySlug, getPostTags } from "@/data/entities/post";
import { getAiAgentById } from "@/data/entities/ai-agent";
import { PostService } from "@/services/post-service";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = Math.floor(Date.now() / 1000);

const sampleAgent: AiAgent = {
  id: "agent-1",
  name: "Claude Daily",
  slug: "claude-daily",
  description: "Daily journal",
  category_id: "cat-agent",
  avatar_version: null,
  created_at: now,
  updated_at: now,
};

const samplePost: PostWithAgent = createMockPostWithAgent({
  id: "post-1",
  title: "Test Post",
  slug: "test-post",
  content: "# Test",
  content_html: "<h1>Test</h1>",
  excerpt: null,
  status: "private",
  category_id: "cat-agent",
  ai_agent_id: "agent-1",
  category_name: "Agent Category",
  category_slug: "agent-category",
  agent_name: "Claude Daily",
  agent_slug: "claude-daily",
  agent_avatar_version: null,
  featured_image: null,
  comment_enabled: 1,
  comment_count: 0,
  view_count: 0,
  reading_time: null,
  wp_id: null,
  wp_permalink: null,
  reference_url: null,
  reference_title: null,
  reference_description: null,
  reference_image: null,
  published_at: null,
  created_at: now,
  updated_at: now,
});

const otherAgentPost: PostWithAgent = createMockPostWithAgent({
  ...samplePost,
  id: "post-other",
  ai_agent_id: "agent-other",
  agent_name: "Other Agent",
  agent_slug: "other-agent",
});

// ---------------------------------------------------------------------------
// createAuthorPostEntity
// ---------------------------------------------------------------------------

describe("createAuthorPostEntity", () => {
  let db: Db;
  let entity: ReturnType<typeof createAuthorPostEntity>;

  beforeEach(() => {
    db = createMockDb();
    entity = createAuthorPostEntity();
    vi.resetAllMocks();
  });

  describe("list", () => {
    it("requires author_id", async () => {
      await expect(
        entity.dataLayer.list(db, {}),
      ).rejects.toThrow("author_id is required");
    });

    it("validates author exists", async () => {
      vi.mocked(getAiAgentById).mockResolvedValue(null);

      await expect(
        entity.dataLayer.list(db, { author_id: "invalid-author" }),
      ).rejects.toThrow("Author not found: invalid-author");
    });

    it("filters by author_id when valid", async () => {
      vi.mocked(getAiAgentById).mockResolvedValue(sampleAgent);
      vi.mocked(listPosts).mockResolvedValue({ posts: [samplePost], total: 1 });

      await entity.dataLayer.list(db, { author_id: "agent-1" });

      expect(listPosts).toHaveBeenCalledWith(db, expect.objectContaining({
        aiAgentId: "agent-1",
      }));
    });
  });

  describe("getById", () => {
    it("requires author_id", async () => {
      await expect(
        entity.dataLayer.getById(db, "post-1", {}),
      ).rejects.toThrow("author_id is required");
    });

    it("returns post if owned by author", async () => {
      vi.mocked(getAiAgentById).mockResolvedValue(sampleAgent);
      vi.mocked(getPostById).mockResolvedValue(samplePost);

      const result = await entity.dataLayer.getById(db, "post-1", { author_id: "agent-1" });

      expect(result).toEqual(samplePost);
    });

    it("returns null if post is owned by different author", async () => {
      vi.mocked(getAiAgentById).mockResolvedValue(sampleAgent);
      vi.mocked(getPostById).mockResolvedValue(otherAgentPost);

      const result = await entity.dataLayer.getById(db, "post-other", { author_id: "agent-1" });

      expect(result).toBeNull();
    });
  });

  describe("getBySlug", () => {
    it("requires author_id", async () => {
      await expect(
        entity.dataLayer.getBySlug(db, "test-post", {}),
      ).rejects.toThrow("author_id is required");
    });

    it("returns post if owned by author", async () => {
      vi.mocked(getAiAgentById).mockResolvedValue(sampleAgent);
      vi.mocked(getPostBySlug).mockResolvedValue(samplePost);

      const result = await entity.dataLayer.getBySlug(db, "test-post", { author_id: "agent-1" });

      expect(result).toEqual(samplePost);
    });

    it("returns null if post is owned by different author", async () => {
      vi.mocked(getAiAgentById).mockResolvedValue(sampleAgent);
      vi.mocked(getPostBySlug).mockResolvedValue(otherAgentPost);

      const result = await entity.dataLayer.getBySlug(db, "test-post", { author_id: "agent-1" });

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("requires author_id", async () => {
      await expect(
        entity.dataLayer.create(db, { title: "New", slug: "new", content: "Content" }),
      ).rejects.toThrow("author_id is required");
    });

    it("forces category, status, and aiAgentId from author", async () => {
      vi.mocked(getAiAgentById).mockResolvedValue(sampleAgent);
      vi.mocked(PostService.create).mockResolvedValue(samplePost);

      await entity.dataLayer.create(db, {
        author_id: "agent-1",
        title: "New",
        slug: "new",
        content: "Content",
      });

      expect(PostService.create).toHaveBeenCalledWith(db, expect.objectContaining({
        categoryId: "cat-agent",
        status: "private",
        aiAgentId: "agent-1",
      }));
    });

    it("ignores client-provided category, status, and aiAgentId", async () => {
      vi.mocked(getAiAgentById).mockResolvedValue(sampleAgent);
      vi.mocked(PostService.create).mockResolvedValue(samplePost);

      await entity.dataLayer.create(db, {
        author_id: "agent-1",
        title: "New",
        slug: "new",
        content: "Content",
        categoryId: "cat-other",
        status: "published",
        aiAgentId: "agent-other",
      });

      // All should be overwritten
      expect(PostService.create).toHaveBeenCalledWith(db, expect.objectContaining({
        categoryId: "cat-agent",
        status: "private",
        aiAgentId: "agent-1",
      }));
    });
  });

  describe("update", () => {
    it("requires author_id", async () => {
      await expect(
        entity.dataLayer.update(db, "post-1", { title: "Updated" }),
      ).rejects.toThrow("author_id is required");
    });

    it("verifies ownership before update", async () => {
      vi.mocked(getAiAgentById).mockResolvedValue(sampleAgent);
      vi.mocked(getPostById).mockResolvedValue(otherAgentPost);

      await expect(
        entity.dataLayer.update(db, "post-other", { author_id: "agent-1", title: "Updated" }),
      ).rejects.toThrow("Post not found or access denied");
    });

    it("strips status from update", async () => {
      vi.mocked(getAiAgentById).mockResolvedValue(sampleAgent);
      vi.mocked(getPostById).mockResolvedValue(samplePost);
      vi.mocked(PostService.update).mockResolvedValue(samplePost);

      await entity.dataLayer.update(db, "post-1", {
        author_id: "agent-1",
        title: "Updated",
        status: "published", // should be ignored
      });

      const updateCall = vi.mocked(PostService.update).mock.calls[0][2];
      expect(updateCall).not.toHaveProperty("status");
    });

    it("throws when trying to change category", async () => {
      vi.mocked(getAiAgentById).mockResolvedValue(sampleAgent);

      await expect(
        entity.dataLayer.update(db, "post-1", {
          author_id: "agent-1",
          title: "Updated",
          categoryId: "cat-other",
        }),
      ).rejects.toThrow("Cannot move post to different category");
    });

    it("throws when trying to reassign to different author", async () => {
      vi.mocked(getAiAgentById).mockResolvedValue(sampleAgent);

      await expect(
        entity.dataLayer.update(db, "post-1", {
          author_id: "agent-1",
          title: "Updated",
          aiAgentId: "agent-other",
        }),
      ).rejects.toThrow("Cannot reassign post to different author");
    });
  });

  describe("delete", () => {
    it("requires author_id", async () => {
      await expect(
        entity.dataLayer.delete(db, "post-1", {}),
      ).rejects.toThrow("author_id is required");
    });

    it("verifies ownership before delete", async () => {
      vi.mocked(getAiAgentById).mockResolvedValue(sampleAgent);
      vi.mocked(getPostById).mockResolvedValue(otherAgentPost);

      await expect(
        entity.dataLayer.delete(db, "post-other", { author_id: "agent-1" }),
      ).rejects.toThrow("Post not found or access denied");
    });

    it("deletes when ownership verified", async () => {
      vi.mocked(getAiAgentById).mockResolvedValue(sampleAgent);
      vi.mocked(getPostById).mockResolvedValue(samplePost);
      vi.mocked(PostService.delete).mockResolvedValue(true);

      await entity.dataLayer.delete(db, "post-1", { author_id: "agent-1" });

      expect(PostService.delete).toHaveBeenCalledWith(db, "post-1");
    });
  });

  describe("hooks", () => {
    it("afterGet enriches with tags", async () => {
      vi.mocked(getPostTags).mockResolvedValue([{ id: "tag-1", name: "Test", slug: "test" }]);

      const result = await entity.hooks!.afterGet!({ db }, samplePost);

      expect(getPostTags).toHaveBeenCalledWith(db, "post-1");
      expect(result).toHaveProperty("tags");
    });

    it("mapCreateInput maps snake_case to camelCase", () => {
      const mapped = entity.hooks!.mapCreateInput!({
        title: "Test",
        tag_ids: ["tag-1"],
        featured_image: "img.png",
      });

      expect(mapped).toEqual({
        title: "Test",
        tagIds: ["tag-1"],
        featuredImage: "img.png",
      });
    });

    it("mapUpdateInput maps snake_case and new_slug", () => {
      const mapped = entity.hooks!.mapUpdateInput!({
        title: "Updated",
        new_slug: "updated-slug",
        tag_ids: ["tag-1"],
        featured_image: "new.png",
      });

      expect(mapped).toEqual({
        title: "Updated",
        slug: "updated-slug",
        tagIds: ["tag-1"],
        featuredImage: "new.png",
      });
    });
  });

  describe("schema", () => {
    it("list schema includes author_id", () => {
      expect(entity.schemas.list).toHaveProperty("author_id");
    });

    it("create schema includes author_id", () => {
      expect(entity.schemas.create).toHaveProperty("author_id");
    });

    it("update schema includes author_id", () => {
      expect(entity.schemas.update).toHaveProperty("author_id");
    });

    it("create schema does not include status or category_id", () => {
      expect(entity.schemas.create).not.toHaveProperty("status");
      expect(entity.schemas.create).not.toHaveProperty("category_id");
    });

    it("update schema does not include status or category_id", () => {
      expect(entity.schemas.update).not.toHaveProperty("status");
      expect(entity.schemas.update).not.toHaveProperty("category_id");
    });
  });

  describe("extraTools", () => {
    it("has no extra tools", () => {
      expect(entity.extraTools).toEqual([]);
    });
  });
});
