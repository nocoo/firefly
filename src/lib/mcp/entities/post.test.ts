// ---------------------------------------------------------------------------
// Post Entity — Integration Tests
// Covers hooks, projection, extra tools, and all CRUD paths.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Post, PostWithAgent, Tag, AiAgent } from "@/models/types";
import { createCrudHandlers } from "../framework/handlers";
import {
  createMockContext,
  parseToolResult,
  expectError,
} from "../framework/test-utils";
import { createMockPostWithAgent } from "@/data/core/test-utils";
import { postEntity } from "./post";
import type { ToolContext } from "../framework/types";

// ---------------------------------------------------------------------------
// Mock all external dependencies
// ---------------------------------------------------------------------------

vi.mock("@/data/entities/post", () => ({
  listPosts: vi.fn(),
  getPostById: vi.fn(),
  getPostBySlug: vi.fn(),
  updatePost: vi.fn(),
  getPostTags: vi.fn(),
}));

vi.mock("@/services/post-service", () => ({
  PostService: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/services/ai", () => ({
  generateExcerpt: vi.fn(),
  summarizeUnfurl: vi.fn(),
}));

vi.mock("@/services/unfurl", () => ({
  unfurlUrl: vi.fn(),
  UnfurlError: class UnfurlError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.name = "UnfurlError";
      this.statusCode = statusCode;
    }
  },
}));

vi.mock("@/data/entities/ai-agent", () => ({
  getAiAgentByCategoryId: vi.fn(),
}));

import {
  listPosts,
  getPostById,
  getPostBySlug,
  updatePost,
  getPostTags,
} from "@/data/entities/post";
import { PostService } from "@/services/post-service";
import { generateExcerpt, summarizeUnfurl } from "@/services/ai";
import { unfurlUrl, UnfurlError } from "@/services/unfurl";
import { getAiAgentByCategoryId } from "@/data/entities/ai-agent";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const now = Math.floor(Date.now() / 1000);

const samplePostWithAgent: PostWithAgent = createMockPostWithAgent({
  id: "post-1",
  title: "Test Post",
  slug: "test-post",
  content: "# Hello",
  content_html: "<h1>Hello</h1>",
  excerpt: "Hello",
  status: "published",
  category_id: "cat-1",
  category_name: "Tech",
  category_slug: "tech",
  published_at: now,
  created_at: now,
  updated_at: now,
});

const sampleTags: Pick<Tag, "id" | "name" | "slug">[] = [
  { id: "tag-1", name: "TypeScript", slug: "typescript" },
];

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("post entity handlers", () => {
  let ctx: ToolContext;
  let handlers: ReturnType<typeof createCrudHandlers<Post>>;

  beforeEach(() => {
    ctx = createMockContext();
    handlers = createCrudHandlers(postEntity);
    vi.mocked(listPosts).mockReset();
    vi.mocked(getPostById).mockReset();
    vi.mocked(getPostBySlug).mockReset();
    vi.mocked(PostService.create).mockReset();
    vi.mocked(PostService.update).mockReset();
    vi.mocked(PostService.delete).mockReset();
    vi.mocked(updatePost).mockReset();
    vi.mocked(getPostTags).mockReset();
    vi.mocked(generateExcerpt).mockReset();
    vi.mocked(summarizeUnfurl).mockReset();
    vi.mocked(unfurlUrl).mockReset();
    vi.mocked(getAiAgentByCategoryId).mockReset();
  });

  // ---- list + projection ----

  describe("handleList", () => {
    it("returns paginated posts with projection", async () => {
      vi.mocked(listPosts).mockResolvedValue({
        posts: [samplePostWithAgent],
        total: 1,
      });
      const result = await handlers.handleList(ctx, {});
      const data = parseToolResult(result) as {
        posts: Record<string, unknown>[];
        total: number;
      };
      expect(data.total).toBe(1);
      expect(data.posts).toHaveLength(1);
      // Projected: should NOT have content/content_html/wp_id/wp_permalink
      expect(data.posts[0]).not.toHaveProperty("content");
      expect(data.posts[0]).not.toHaveProperty("content_html");
      expect(data.posts[0]).not.toHaveProperty("wp_id");
      // Should still have title, slug, etc.
      expect(data.posts[0]).toHaveProperty("title", "Test Post");
      expect(data.posts[0]).toHaveProperty("slug", "test-post");
    });

    it("restores content with include group", async () => {
      vi.mocked(listPosts).mockResolvedValue({
        posts: [samplePostWithAgent],
        total: 1,
      });
      const result = await handlers.handleList(ctx, {
        include: ["content"],
      });
      const data = parseToolResult(result) as {
        posts: Record<string, unknown>[];
      };
      expect(data.posts[0]).toHaveProperty("content", "# Hello");
      expect(data.posts[0]).not.toHaveProperty("content_html");
    });

    it("returns all fields with 'full' include", async () => {
      vi.mocked(listPosts).mockResolvedValue({
        posts: [samplePostWithAgent],
        total: 1,
      });
      const result = await handlers.handleList(ctx, { include: ["full"] });
      const data = parseToolResult(result) as {
        posts: Record<string, unknown>[];
      };
      expect(data.posts[0]).toHaveProperty("content");
      expect(data.posts[0]).toHaveProperty("content_html");
      expect(data.posts[0]).toHaveProperty("wp_id");
    });

    it("passes filters to data layer", async () => {
      vi.mocked(listPosts).mockResolvedValue({ posts: [], total: 0 });
      await handlers.handleList(ctx, {
        status: "draft",
        category_id: "cat-1",
        page: 2,
        page_size: 10,
      });
      expect(listPosts).toHaveBeenCalledWith(
        ctx.db,
        expect.objectContaining({
          status: "draft",
          categoryId: "cat-1",
          page: 2,
          pageSize: 10,
        }),
      );
    });

    it("defaults pagination when opts are omitted in the data layer", async () => {
      vi.mocked(listPosts).mockResolvedValue({ posts: [], total: 0 });

      const result = await postEntity.dataLayer.list(ctx.db, undefined);

      expect(result).toEqual({ items: [], total: 0 });
      expect(listPosts).toHaveBeenCalledWith(
        ctx.db,
        expect.objectContaining({
          page: 1,
          pageSize: 20,
        }),
      );
    });
  });

  // ---- get + afterGet hook ----

  describe("handleGet", () => {
    it("enriches post with tags via afterGet", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
      vi.mocked(getPostTags).mockResolvedValue(sampleTags);

      const result = await handlers.handleGet(ctx, { slug: "test-post" });
      const data = parseToolResult(result) as PostWithAgent & {
        tags: typeof sampleTags;
      };
      expect(data.tags).toEqual(sampleTags);
      expect(getPostTags).toHaveBeenCalledWith(ctx.db, "post-1");
    });

    it("resolves by id", async () => {
      vi.mocked(getPostById).mockResolvedValue(samplePostWithAgent);
      vi.mocked(getPostTags).mockResolvedValue([]);

      const result = await handlers.handleGet(ctx, { id: "post-1" });
      const data = parseToolResult(result) as PostWithAgent;
      expect(data.title).toBe("Test Post");
    });

    it("returns error for missing post", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(null);
      const result = await handlers.handleGet(ctx, { slug: "missing" });
      expectError(result, "Post not found: missing");
    });
  });

  // ---- create (via PostService) ----

  describe("handleCreate", () => {
    it("maps tag_ids to tagIds for PostService (mapCreateInput)", async () => {
      vi.mocked(PostService.create).mockResolvedValue(samplePostWithAgent);

      await handlers.handleCreate(ctx, {
        title: "New",
        slug: "new",
        content: "body",
        tag_ids: ["tag-1"],
      });

      // PostService.create should receive tagIds, not tag_ids
      const createCallArgs = vi.mocked(PostService.create).mock.calls[0][1];
      expect(createCallArgs).toHaveProperty("tagIds", ["tag-1"]);
      expect(createCallArgs).not.toHaveProperty("tag_ids");
    });

    it("maps snake_case fields to camelCase for PostService", async () => {
      vi.mocked(PostService.create).mockResolvedValue(samplePostWithAgent);

      await handlers.handleCreate(ctx, {
        title: "New",
        slug: "new",
        content: "body",
        category_id: "cat-1",
        featured_image: "img.png",
        published_at: 1234567890,
      });

      const createCallArgs = vi.mocked(PostService.create).mock.calls[0][1];
      expect(createCallArgs).toHaveProperty("categoryId", "cat-1");
      expect(createCallArgs).toHaveProperty("featuredImage", "img.png");
      expect(createCallArgs).toHaveProperty("publishedAt", 1234567890);
      expect(createCallArgs).not.toHaveProperty("category_id");
      expect(createCallArgs).not.toHaveProperty("featured_image");
      expect(createCallArgs).not.toHaveProperty("published_at");
    });

    it("omits tagIds when no tag_ids provided", async () => {
      vi.mocked(PostService.create).mockResolvedValue(samplePostWithAgent);

      await handlers.handleCreate(ctx, {
        title: "New",
        slug: "new",
        content: "body",
      });

      const createCallArgs = vi.mocked(PostService.create).mock.calls[0][1];
      expect(createCallArgs).not.toHaveProperty("tagIds");
      expect(createCallArgs).not.toHaveProperty("tag_ids");
    });

    it("throws error when category is bound to an AI agent", async () => {
      vi.mocked(getAiAgentByCategoryId).mockResolvedValue(sampleAgent);

      await expect(
        handlers.handleCreate(ctx, {
          title: "New",
          slug: "new",
          content: "body",
          category_id: "cat-agent",
        }),
      ).rejects.toThrow("This category is bound to an AI agent");
    });

    it("allows create when category has no agent", async () => {
      vi.mocked(getAiAgentByCategoryId).mockResolvedValue(null);
      vi.mocked(PostService.create).mockResolvedValue(samplePostWithAgent);

      await handlers.handleCreate(ctx, {
        title: "New",
        slug: "new",
        content: "body",
        category_id: "cat-1",
      });

      expect(PostService.create).toHaveBeenCalled();
    });

    it("allows create without category_id", async () => {
      vi.mocked(PostService.create).mockResolvedValue(samplePostWithAgent);

      await handlers.handleCreate(ctx, {
        title: "New",
        slug: "new",
        content: "body",
      });

      expect(getAiAgentByCategoryId).not.toHaveBeenCalled();
      expect(PostService.create).toHaveBeenCalled();
    });
  });

  // ---- update (via PostService) ----

  describe("handleUpdate", () => {
    it("maps new_slug to slug and tag_ids to tagIds", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
      vi.mocked(PostService.update).mockResolvedValue(samplePostWithAgent);

      await handlers.handleUpdate(ctx, {
        slug: "test-post",
        new_slug: "test-post-v2",
        title: "Updated",
        tag_ids: ["tag-2"],
      });

      expect(PostService.update).toHaveBeenCalledWith(ctx.db, "post-1", {
        slug: "test-post-v2",
        title: "Updated",
        tagIds: ["tag-2"],
      });
    });

    it("maps nullable snake_case update fields to camelCase", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
      vi.mocked(PostService.update).mockResolvedValue(samplePostWithAgent);

      await handlers.handleUpdate(ctx, {
        slug: "test-post",
        category_id: null,
        featured_image: null,
        published_at: null,
        reference_url: "https://example.com/ref",
        reference_title: "Reference Title",
        reference_description: null,
        reference_image: "cover.png",
      });

      const updateCallArgs = vi.mocked(PostService.update).mock.calls[0][2];
      expect(updateCallArgs).toEqual({
        categoryId: null,
        featuredImage: null,
        publishedAt: null,
        referenceUrl: "https://example.com/ref",
        referenceTitle: "Reference Title",
        referenceDescription: null,
        referenceImage: "cover.png",
      });
      expect(updateCallArgs).not.toHaveProperty("category_id");
      expect(updateCallArgs).not.toHaveProperty("featured_image");
      expect(updateCallArgs).not.toHaveProperty("published_at");
      expect(updateCallArgs).not.toHaveProperty("reference_url");
      expect(updateCallArgs).not.toHaveProperty("reference_title");
      expect(updateCallArgs).not.toHaveProperty("reference_description");
      expect(updateCallArgs).not.toHaveProperty("reference_image");
    });

    it("omits tagIds when tag_ids not provided", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
      vi.mocked(PostService.update).mockResolvedValue(samplePostWithAgent);

      await handlers.handleUpdate(ctx, {
        slug: "test-post",
        title: "Just title",
      });

      const updateCallArgs = vi.mocked(PostService.update).mock.calls[0][2];
      expect(updateCallArgs).not.toHaveProperty("tagIds");
      expect(updateCallArgs).not.toHaveProperty("tag_ids");
    });

    it("returns error when PostService.update returns null", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
      vi.mocked(PostService.update).mockResolvedValue(null);

      const result = await handlers.handleUpdate(ctx, {
        slug: "test-post",
        title: "Updated",
      });
      expectError(result, "Post not found: post-1");
    });

    it("throws error when moving post to agent-bound category", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
      vi.mocked(getPostById).mockResolvedValue(samplePostWithAgent);
      vi.mocked(getAiAgentByCategoryId).mockResolvedValue(sampleAgent);

      await expect(
        handlers.handleUpdate(ctx, {
          slug: "test-post",
          category_id: "cat-agent",
        }),
      ).rejects.toThrow("Cannot move post to a category bound to an AI agent");
    });

    it("allows update when staying in same category (no agent check needed)", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
      vi.mocked(PostService.update).mockResolvedValue(samplePostWithAgent);

      await handlers.handleUpdate(ctx, {
        slug: "test-post",
        category_id: "cat-1", // same as existing post
        title: "Updated",
      });

      expect(getAiAgentByCategoryId).not.toHaveBeenCalled();
      expect(PostService.update).toHaveBeenCalled();
    });

    it("allows update when moving to category without agent", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
      vi.mocked(getPostById).mockResolvedValue(samplePostWithAgent);
      vi.mocked(getAiAgentByCategoryId).mockResolvedValue(null);
      vi.mocked(PostService.update).mockResolvedValue({
        ...samplePostWithAgent,
        category_id: "cat-2",
      });

      await handlers.handleUpdate(ctx, {
        slug: "test-post",
        category_id: "cat-2",
        title: "Updated",
      });

      expect(getAiAgentByCategoryId).toHaveBeenCalledWith(ctx.db, "cat-2");
      expect(PostService.update).toHaveBeenCalled();
    });

    it("allows update without changing category", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
      vi.mocked(PostService.update).mockResolvedValue(samplePostWithAgent);

      await handlers.handleUpdate(ctx, {
        slug: "test-post",
        title: "Just title",
      });

      expect(getAiAgentByCategoryId).not.toHaveBeenCalled();
      expect(PostService.update).toHaveBeenCalled();
    });
  });

  // ---- delete ----

  describe("handleDelete", () => {
    it("deletes post by slug", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
      vi.mocked(PostService.delete).mockResolvedValue(true);

      const result = await handlers.handleDelete(ctx, { slug: "test-post" });
      expect(PostService.delete).toHaveBeenCalledWith(ctx.db, "post-1");
      const data = parseToolResult(result) as { deleted: boolean };
      expect(data.deleted).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Extra tools
// ---------------------------------------------------------------------------

describe("generate_excerpt extra tool", () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = createMockContext();
    vi.mocked(getPostById).mockReset();
    vi.mocked(getPostBySlug).mockReset();
    vi.mocked(generateExcerpt).mockReset();
    vi.mocked(updatePost).mockReset();
  });

  const excerptTool = postEntity.extraTools!.find(
    (t) => t.name === "generate_excerpt",
  )!;

  it("generates excerpt by slug and saves to DB", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
    vi.mocked(generateExcerpt).mockResolvedValue("AI excerpt");
    vi.mocked(updatePost).mockResolvedValue(samplePostWithAgent);

    const result = await excerptTool.handler(ctx, { slug: "test-post" });
    const data = parseToolResult(result);
    expect(data).toEqual({ slug: "test-post", excerpt: "AI excerpt", saved: true });
    expect(updatePost).toHaveBeenCalledWith(ctx.db, "post-1", { excerpt: "AI excerpt" });
  });

  it("generates excerpt by id and saves to DB", async () => {
    vi.mocked(getPostById).mockResolvedValue(samplePostWithAgent);
    vi.mocked(generateExcerpt).mockResolvedValue("AI excerpt");
    vi.mocked(updatePost).mockResolvedValue(samplePostWithAgent);

    const result = await excerptTool.handler(ctx, { id: "post-1" });
    const data = parseToolResult(result);
    expect(data).toEqual({ slug: "test-post", excerpt: "AI excerpt", saved: true });
    expect(updatePost).toHaveBeenCalledWith(ctx.db, "post-1", { excerpt: "AI excerpt" });
  });

  it("returns error for missing post", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(null);

    const result = await excerptTool.handler(ctx, { slug: "missing" });
    expectError(result, "Post not found: missing");
  });

  it("returns error when AI not configured", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
    vi.mocked(generateExcerpt).mockRejectedValue(
      new Error("AI not configured"),
    );

    const result = await excerptTool.handler(ctx, { slug: "test-post" });
    expectError(result, "AI provider not configured");
  });

  it("wraps non-Error excerpt failures", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
    vi.mocked(generateExcerpt).mockRejectedValue("AI gateway down");

    const result = await excerptTool.handler(ctx, { slug: "test-post" });
    expectError(result, "Excerpt generation failed: AI gateway down");
  });

  it("returns error for other AI failures", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
    vi.mocked(generateExcerpt).mockRejectedValue(new Error("API timeout"));

    const result = await excerptTool.handler(ctx, { slug: "test-post" });
    expectError(result, "Excerpt generation failed: API timeout");
  });
});

describe("unfurl_reference extra tool", () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = createMockContext();
    vi.mocked(getPostById).mockReset();
    vi.mocked(getPostBySlug).mockReset();
    vi.mocked(updatePost).mockReset();
    vi.mocked(unfurlUrl).mockReset();
    vi.mocked(summarizeUnfurl).mockReset();
  });

  const unfurlTool = postEntity.extraTools!.find(
    (t) => t.name === "unfurl_reference",
  )!;

  it("preview mode: unfurls url without saving", async () => {
    vi.mocked(unfurlUrl).mockResolvedValue({
      url: "https://example.com",
      ogTitle: "Example",
      ogDescription: "Desc",
      ogImage: "img.png",
      pageTitle: "Page",
      readmeImage: null,
      bodyText: "text",
    });
    vi.mocked(summarizeUnfurl).mockResolvedValue({
      title: "AI Title",
      description: "AI Desc",
    });

    const result = await unfurlTool.handler(ctx, {
      url: "https://example.com",
    });
    const data = parseToolResult(result) as Record<string, unknown>;
    expect(data.title).toBe("AI Title");
    expect(data).not.toHaveProperty("saved");
    expect(updatePost).not.toHaveBeenCalled();
  });

  it("save mode: unfurls and saves to post", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
    vi.mocked(unfurlUrl).mockResolvedValue({
      url: "https://example.com",
      ogTitle: "Example",
      ogDescription: "Desc",
      ogImage: "img.png",
      pageTitle: "Page",
      readmeImage: null,
      bodyText: "text",
    });
    vi.mocked(summarizeUnfurl).mockResolvedValue(null);
    vi.mocked(updatePost).mockResolvedValue(samplePostWithAgent);

    const result = await unfurlTool.handler(ctx, {
      slug: "test-post",
      url: "https://example.com",
    });
    const data = parseToolResult(result) as Record<string, unknown>;
    expect(data.saved).toBe(true);
    expect(updatePost).toHaveBeenCalled();
  });

  it("save mode: returns validation error when both id and slug are provided", async () => {
    const result = await unfurlTool.handler(ctx, {
      id: "post-1",
      slug: "test-post",
    });

    expectError(result, "Provide either id or slug, not both");
    expect(unfurlUrl).not.toHaveBeenCalled();
  });

  it("save mode: prefers AI title over raw metadata", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
    vi.mocked(unfurlUrl).mockResolvedValue({
      url: "https://example.com",
      ogTitle: "Raw Title",
      ogDescription: "Raw Desc",
      ogImage: null,
      pageTitle: "Page Title",
      readmeImage: "readme.png",
      bodyText: "text",
    });
    vi.mocked(summarizeUnfurl).mockResolvedValue({
      title: "AI Title",
      description: "AI Desc",
    });
    vi.mocked(updatePost).mockResolvedValue(samplePostWithAgent);

    const result = await unfurlTool.handler(ctx, {
      slug: "test-post",
      url: "https://example.com",
    });
    const data = parseToolResult(result) as Record<string, unknown>;
    expect(data.title).toBe("AI Title");
    expect(data.description).toBe("AI Desc");
    expect(data.saved).toBe(true);
  });

  it("save mode: uses post reference_url when no url provided", async () => {
    const postWithRef = {
      ...samplePostWithAgent,
      reference_url: "https://saved.com",
    };
    vi.mocked(getPostById).mockResolvedValue(postWithRef);
    vi.mocked(unfurlUrl).mockResolvedValue({
      url: "https://saved.com",
      ogTitle: "Saved",
      ogDescription: "Desc",
      ogImage: null,
      pageTitle: "Page",
      readmeImage: null,
      bodyText: "text",
    });
    vi.mocked(summarizeUnfurl).mockResolvedValue(null);
    vi.mocked(updatePost).mockResolvedValue(postWithRef);

    const result = await unfurlTool.handler(ctx, { id: "post-1" });
    expect(unfurlUrl).toHaveBeenCalledWith("https://saved.com");
    const data = parseToolResult(result) as Record<string, unknown>;
    expect(data.saved).toBe(true);
  });

  it("returns error when no url on post and none provided", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);

    const result = await unfurlTool.handler(ctx, { slug: "test-post" });
    expectError(result, "No reference URL on post and no url provided");
  });

  it("returns error when neither url nor id/slug", async () => {
    const result = await unfurlTool.handler(ctx, {});
    expectError(result, "Either url or slug is required");
  });

  it("returns UnfurlError message directly", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
    vi.mocked(unfurlUrl).mockRejectedValue(
      new UnfurlError("403 Forbidden", 403),
    );

    const result = await unfurlTool.handler(ctx, {
      slug: "test-post",
      url: "https://blocked.com",
    });
    expectError(result, "403 Forbidden");
  });

  it("preview mode: wraps generic error with 'Unfurl failed' prefix", async () => {
    vi.mocked(unfurlUrl).mockRejectedValue(new Error("Network timeout"));

    const result = await unfurlTool.handler(ctx, {
      url: "https://timeout.com",
    });
    expectError(result, "Unfurl failed: Network timeout");
  });

  it("preview mode: handles non-Error throw", async () => {
    vi.mocked(unfurlUrl).mockRejectedValue("string error");

    const result = await unfurlTool.handler(ctx, {
      url: "https://fail.com",
    });
    expectError(result, "Unfurl failed: string error");
  });

  it("preview mode: returns UnfurlError message directly", async () => {
    vi.mocked(unfurlUrl).mockRejectedValue(
      new UnfurlError("404 Not Found", 404),
    );

    const result = await unfurlTool.handler(ctx, {
      url: "https://missing.com",
    });
    expectError(result, "404 Not Found");
  });

  it("save mode: wraps generic error with 'Unfurl failed' prefix", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
    vi.mocked(unfurlUrl).mockRejectedValue(new Error("DNS failure"));

    const result = await unfurlTool.handler(ctx, {
      slug: "test-post",
      url: "https://dns-fail.com",
    });
    expectError(result, "Unfurl failed: DNS failure");
  });

  it("save mode: handles non-Error throw", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
    vi.mocked(unfurlUrl).mockRejectedValue(42);

    const result = await unfurlTool.handler(ctx, {
      slug: "test-post",
      url: "https://num-fail.com",
    });
    expectError(result, "Unfurl failed: 42");
  });

  it("preview mode: falls back through title/description/image chain", async () => {
    vi.mocked(unfurlUrl).mockResolvedValue({
      url: "https://bare.com",
      ogTitle: null,
      ogDescription: null,
      ogImage: null,
      pageTitle: null,
      readmeImage: "readme.png",
      bodyText: "text",
    });
    vi.mocked(summarizeUnfurl).mockResolvedValue(null);

    const result = await unfurlTool.handler(ctx, {
      url: "https://bare.com",
    });
    const data = parseToolResult(result) as Record<string, unknown>;
    // Falls back to hostname when all titles are null
    expect(data.title).toBe("bare.com");
    expect(data.description).toBe("");
    // Falls back to readmeImage when ogImage is null
    expect(data.image).toBe("readme.png");
  });

  it("preview mode: returns null image when no image metadata exists", async () => {
    vi.mocked(unfurlUrl).mockResolvedValue({
      url: "https://plain.com",
      ogTitle: "Plain",
      ogDescription: null,
      ogImage: null,
      pageTitle: null,
      readmeImage: null,
      bodyText: "text",
    });
    vi.mocked(summarizeUnfurl).mockResolvedValue(null);

    const result = await unfurlTool.handler(ctx, {
      url: "https://plain.com",
    });
    const data = parseToolResult(result) as Record<string, unknown>;
    expect(data.title).toBe("Plain");
    expect(data.image).toBeNull();
  });

  it("save mode: falls back to pageTitle when ogTitle is null", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
    vi.mocked(unfurlUrl).mockResolvedValue({
      url: "https://example.com",
      ogTitle: null,
      ogDescription: null,
      ogImage: null,
      pageTitle: "Page Title",
      readmeImage: null,
      bodyText: "text",
    });
    vi.mocked(summarizeUnfurl).mockResolvedValue(null);
    vi.mocked(updatePost).mockResolvedValue(samplePostWithAgent);

    const result = await unfurlTool.handler(ctx, {
      slug: "test-post",
      url: "https://example.com",
    });
    const data = parseToolResult(result) as Record<string, unknown>;
    expect(data.title).toBe("Page Title");
    expect(data.saved).toBe(true);
  });

  it("save mode: falls back to the hostname when no title metadata exists", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithAgent);
    vi.mocked(unfurlUrl).mockResolvedValue({
      url: "https://fallback.example.com/path",
      ogTitle: null,
      ogDescription: null,
      ogImage: null,
      pageTitle: null,
      readmeImage: null,
      bodyText: "text",
    });
    vi.mocked(summarizeUnfurl).mockResolvedValue(null);
    vi.mocked(updatePost).mockResolvedValue(samplePostWithAgent);

    const result = await unfurlTool.handler(ctx, {
      slug: "test-post",
      url: "https://fallback.example.com/path",
    });
    const data = parseToolResult(result) as Record<string, unknown>;
    expect(data.title).toBe("fallback.example.com");
    expect(data.saved).toBe(true);
  });
});
