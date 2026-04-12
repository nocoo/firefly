import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import type { PostWithAgent, AiAgent } from "@/models/types";
import { createMockPostWithAgent } from "@/data/core/test-utils";
import { createAgentPostEntity } from "./agent-post";

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock("@/data/entities/post", () => ({
  listPosts: vi.fn(),
  getPostById: vi.fn(),
  getPostBySlug: vi.fn(),
  getPostTags: vi.fn(),
}));

vi.mock("@/services/post-service", () => ({
  PostService: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { listPosts, getPostById, getPostBySlug, getPostTags } from "@/data/entities/post";
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
  api_key_hash: "hash",
  api_key_preview: "preview",
  avatar_version: null,
  is_active: 1,
  last_used_at: null,
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
  category_id: "cat-agent", // same as agent's category
  ai_agent_id: "agent-1", // owned by this agent
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
  ai_agent_id: "agent-other", // owned by different agent
  agent_name: "Other Agent",
  agent_slug: "other-agent",
});

// ---------------------------------------------------------------------------
// createAgentPostEntity
// ---------------------------------------------------------------------------

describe("createAgentPostEntity", () => {
  let db: Db;
  let entity: ReturnType<typeof createAgentPostEntity>;

  beforeEach(() => {
    db = createMockDb();
    entity = createAgentPostEntity(sampleAgent);
    vi.resetAllMocks();
  });

  describe("list", () => {
    it("forces agent's ai_agent_id in list query", async () => {
      vi.mocked(listPosts).mockResolvedValue({ posts: [samplePost], total: 1 });

      await entity.dataLayer.list(db, {});

      expect(listPosts).toHaveBeenCalledWith(db, expect.objectContaining({
        aiAgentId: "agent-1",
      }));
    });

    it("throws when trying to access different agent's posts", async () => {
      await expect(
        entity.dataLayer.list(db, { ai_agent_id: "agent-other" }),
      ).rejects.toThrow("Access denied");
    });

    it("allows specifying the same ai_agent_id", async () => {
      vi.mocked(listPosts).mockResolvedValue({ posts: [samplePost], total: 1 });

      await entity.dataLayer.list(db, { ai_agent_id: "agent-1" });

      expect(listPosts).toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("returns post if owned by agent", async () => {
      vi.mocked(getPostById).mockResolvedValue(samplePost);

      const result = await entity.dataLayer.getById(db, "post-1");

      expect(result).toEqual(samplePost);
    });

    it("returns null if post is owned by different agent", async () => {
      vi.mocked(getPostById).mockResolvedValue(otherAgentPost);

      const result = await entity.dataLayer.getById(db, "post-other");

      expect(result).toBeNull();
    });
  });

  describe("getBySlug", () => {
    it("returns post if owned by agent", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(samplePost);

      const result = await entity.dataLayer.getBySlug(db, "test-post");

      expect(result).toEqual(samplePost);
    });

    it("returns null if post is owned by different agent", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(otherAgentPost);

      const result = await entity.dataLayer.getBySlug(db, "test-post");

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("forces category, status, and aiAgentId", async () => {
      vi.mocked(PostService.create).mockResolvedValue(samplePost);

      await entity.dataLayer.create(db, { title: "New", slug: "new", content: "Content" });

      expect(PostService.create).toHaveBeenCalledWith(db, expect.objectContaining({
        categoryId: "cat-agent",
        status: "private",
        aiAgentId: "agent-1",
      }));
    });

    it("ignores client-provided category, status, and aiAgentId", async () => {
      vi.mocked(PostService.create).mockResolvedValue(samplePost);

      await entity.dataLayer.create(db, {
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
    it("strips status from update", async () => {
      vi.mocked(PostService.update).mockResolvedValue(samplePost);

      await entity.dataLayer.update(db, "post-1", {
        title: "Updated",
        status: "published", // should be ignored
      });

      expect(PostService.update).toHaveBeenCalledWith(db, "post-1", {
        title: "Updated",
        // status should NOT be present
      });
    });

    it("throws when trying to change category", async () => {
      await expect(
        entity.dataLayer.update(db, "post-1", {
          title: "Updated",
          categoryId: "cat-other",
        }),
      ).rejects.toThrow("Cannot move post to different category");
    });

    it("throws when trying to reassign to different agent", async () => {
      await expect(
        entity.dataLayer.update(db, "post-1", {
          title: "Updated",
          aiAgentId: "agent-other",
        }),
      ).rejects.toThrow("Cannot reassign post to different agent");
    });

    it("allows updating without changing category or aiAgentId", async () => {
      vi.mocked(PostService.update).mockResolvedValue(samplePost);

      await entity.dataLayer.update(db, "post-1", {
        title: "Updated",
        categoryId: "cat-agent", // same category
        aiAgentId: "agent-1", // same agent
      });

      expect(PostService.update).toHaveBeenCalled();
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
    it("list schema does not include category_id", () => {
      expect(entity.schemas.list).not.toHaveProperty("category_id");
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
