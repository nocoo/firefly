// ---------------------------------------------------------------------------
// Post Entity — Integration Tests
// Covers hooks, projection, extra tools, and all CRUD paths.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Post, PostWithCategory, Tag } from "@/models/types";
import { createCrudHandlers } from "../framework/handlers";
import {
  createMockContext,
  parseToolResult,
  expectError,
} from "../framework/test-utils";
import { postEntity } from "./post";
import type { ToolContext } from "../framework/types";

// ---------------------------------------------------------------------------
// Mock all external dependencies
// ---------------------------------------------------------------------------

vi.mock("@/data/posts", () => ({
  listPosts: vi.fn(),
  getPostById: vi.fn(),
  getPostBySlug: vi.fn(),
  createPost: vi.fn(),
  updatePost: vi.fn(),
  deletePost: vi.fn(),
  getPostTags: vi.fn(),
  setPostTags: vi.fn(),
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

import {
  listPosts,
  getPostById,
  getPostBySlug,
  createPost,
  updatePost,
  deletePost,
  getPostTags,
  setPostTags,
} from "@/data/posts";
import { generateExcerpt, summarizeUnfurl } from "@/services/ai";
import { unfurlUrl, UnfurlError } from "@/services/unfurl";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const now = Math.floor(Date.now() / 1000);

const samplePost: Post = {
  id: "post-1",
  title: "Test Post",
  slug: "test-post",
  content: "# Hello",
  content_html: "<h1>Hello</h1>",
  excerpt: "Hello",
  status: "published",
  category_id: "cat-1",
  featured_image: null,
  comment_enabled: 0,
  comment_count: 0,
  view_count: 0,
  reading_time: 1,
  wp_id: null,
  wp_permalink: null,
  reference_url: null,
  reference_title: null,
  reference_description: null,
  reference_image: null,
  published_at: now,
  created_at: now,
  updated_at: now,
};

const samplePostWithCategory: PostWithCategory = {
  ...samplePost,
  category_name: "Tech",
  category_slug: "tech",
};

const sampleTags: Pick<Tag, "id" | "name" | "slug">[] = [
  { id: "tag-1", name: "TypeScript", slug: "typescript" },
];

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
    vi.mocked(createPost).mockReset();
    vi.mocked(updatePost).mockReset();
    vi.mocked(deletePost).mockReset();
    vi.mocked(getPostTags).mockReset();
    vi.mocked(setPostTags).mockReset();
    vi.mocked(generateExcerpt).mockReset();
    vi.mocked(summarizeUnfurl).mockReset();
    vi.mocked(unfurlUrl).mockReset();
  });

  // ---- list + projection ----

  describe("handleList", () => {
    it("returns paginated posts with projection", async () => {
      vi.mocked(listPosts).mockResolvedValue({
        posts: [samplePostWithCategory],
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
        posts: [samplePostWithCategory],
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
        posts: [samplePostWithCategory],
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
  });

  // ---- get + afterGet hook ----

  describe("handleGet", () => {
    it("enriches post with tags via afterGet", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
      vi.mocked(getPostTags).mockResolvedValue(sampleTags);

      const result = await handlers.handleGet(ctx, { slug: "test-post" });
      const data = parseToolResult(result) as PostWithCategory & {
        tags: typeof sampleTags;
      };
      expect(data.tags).toEqual(sampleTags);
      expect(getPostTags).toHaveBeenCalledWith(ctx.db, "post-1");
    });

    it("resolves by id", async () => {
      vi.mocked(getPostById).mockResolvedValue(samplePostWithCategory);
      vi.mocked(getPostTags).mockResolvedValue([]);

      const result = await handlers.handleGet(ctx, { id: "post-1" });
      const data = parseToolResult(result) as PostWithCategory;
      expect(data.title).toBe("Test Post");
    });

    it("returns error for missing post", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(null);
      const result = await handlers.handleGet(ctx, { slug: "missing" });
      expectError(result, "Post not found: missing");
    });
  });

  // ---- create + afterCreate + rollback ----

  describe("handleCreate", () => {
    it("strips tag_ids from data layer input (mapCreateInput)", async () => {
      vi.mocked(createPost).mockResolvedValue(samplePostWithCategory);
      vi.mocked(setPostTags).mockResolvedValue(undefined);

      await handlers.handleCreate(ctx, {
        title: "New",
        slug: "new",
        content: "body",
        tag_ids: ["tag-1"],
      });

      // createPost should NOT receive tag_ids
      const createCallArgs = vi.mocked(createPost).mock.calls[0][1];
      expect(createCallArgs).not.toHaveProperty("tag_ids");
    });

    it("sets tags via afterCreate", async () => {
      vi.mocked(createPost).mockResolvedValue(samplePostWithCategory);
      vi.mocked(setPostTags).mockResolvedValue(undefined);

      await handlers.handleCreate(ctx, {
        title: "New",
        slug: "new",
        content: "body",
        tag_ids: ["tag-1", "tag-2"],
      });

      expect(setPostTags).toHaveBeenCalledWith(ctx.db, "post-1", [
        "tag-1",
        "tag-2",
      ]);
    });

    it("does not call setPostTags when no tag_ids", async () => {
      vi.mocked(createPost).mockResolvedValue(samplePostWithCategory);

      await handlers.handleCreate(ctx, {
        title: "New",
        slug: "new",
        content: "body",
      });

      expect(setPostTags).not.toHaveBeenCalled();
    });

    it("rolls back by deleting post when afterCreate fails", async () => {
      vi.mocked(createPost).mockResolvedValue(samplePostWithCategory);
      vi.mocked(setPostTags).mockRejectedValue(new Error("tag error"));
      vi.mocked(deletePost).mockResolvedValue(true);

      const result = await handlers.handleCreate(ctx, {
        title: "New",
        slug: "new",
        content: "body",
        tag_ids: ["bad-tag"],
      });

      expectError(result, "afterCreate hook failed");
      expect(deletePost).toHaveBeenCalledWith(ctx.db, "post-1");
    });
  });

  // ---- update + beforeUpdate + rollback ----

  describe("handleUpdate", () => {
    it("maps new_slug to slug and strips tag_ids", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
      vi.mocked(updatePost).mockResolvedValue(samplePostWithCategory);

      await handlers.handleUpdate(ctx, {
        slug: "test-post",
        new_slug: "test-post-v2",
        title: "Updated",
      });

      expect(updatePost).toHaveBeenCalledWith(ctx.db, "post-1", {
        slug: "test-post-v2",
        title: "Updated",
      });
    });

    it("saves old tags and updates them via beforeUpdate", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
      vi.mocked(getPostTags).mockResolvedValue(sampleTags);
      vi.mocked(setPostTags).mockResolvedValue(undefined);
      vi.mocked(updatePost).mockResolvedValue(samplePostWithCategory);

      await handlers.handleUpdate(ctx, {
        slug: "test-post",
        tag_ids: ["tag-2", "tag-3"],
      });

      // Should have called setPostTags with new tags
      expect(setPostTags).toHaveBeenCalledWith(ctx.db, "post-1", [
        "tag-2",
        "tag-3",
      ]);
    });

    it("rolls back tags when updatePost fails", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
      vi.mocked(getPostTags).mockResolvedValue(sampleTags);
      vi.mocked(setPostTags).mockResolvedValue(undefined);
      vi.mocked(updatePost).mockRejectedValue(new Error("DB error"));

      await expect(
        handlers.handleUpdate(ctx, {
          slug: "test-post",
          tag_ids: ["tag-2"],
          title: "fail",
        }),
      ).rejects.toThrow("DB error");

      // Should have called setPostTags twice: first with new, then rollback
      expect(setPostTags).toHaveBeenCalledTimes(2);
      expect(setPostTags).toHaveBeenLastCalledWith(ctx.db, "post-1", [
        "tag-1",
      ]);
    });

    it("does not touch tags when tag_ids not provided", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
      vi.mocked(updatePost).mockResolvedValue(samplePostWithCategory);

      await handlers.handleUpdate(ctx, {
        slug: "test-post",
        title: "Just title",
      });

      expect(getPostTags).not.toHaveBeenCalled();
      expect(setPostTags).not.toHaveBeenCalled();
    });
  });

  // ---- delete ----

  describe("handleDelete", () => {
    it("deletes post by slug", async () => {
      vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
      vi.mocked(deletePost).mockResolvedValue(true);

      const result = await handlers.handleDelete(ctx, { slug: "test-post" });
      expect(deletePost).toHaveBeenCalledWith(ctx.db, "post-1");
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
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
    vi.mocked(generateExcerpt).mockResolvedValue("AI excerpt");
    vi.mocked(updatePost).mockResolvedValue(samplePostWithCategory);

    const result = await excerptTool.handler(ctx, { slug: "test-post" });
    const data = parseToolResult(result);
    expect(data).toEqual({ slug: "test-post", excerpt: "AI excerpt", saved: true });
    expect(updatePost).toHaveBeenCalledWith(ctx.db, "post-1", { excerpt: "AI excerpt" });
  });

  it("generates excerpt by id and saves to DB", async () => {
    vi.mocked(getPostById).mockResolvedValue(samplePostWithCategory);
    vi.mocked(generateExcerpt).mockResolvedValue("AI excerpt");
    vi.mocked(updatePost).mockResolvedValue(samplePostWithCategory);

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
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
    vi.mocked(generateExcerpt).mockRejectedValue(
      new Error("AI not configured"),
    );

    const result = await excerptTool.handler(ctx, { slug: "test-post" });
    expectError(result, "AI provider not configured");
  });

  it("returns error for other AI failures", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
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
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
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
    vi.mocked(updatePost).mockResolvedValue(samplePostWithCategory);

    const result = await unfurlTool.handler(ctx, {
      slug: "test-post",
      url: "https://example.com",
    });
    const data = parseToolResult(result) as Record<string, unknown>;
    expect(data.saved).toBe(true);
    expect(updatePost).toHaveBeenCalled();
  });

  it("save mode: uses post reference_url when no url provided", async () => {
    const postWithRef = {
      ...samplePostWithCategory,
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
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);

    const result = await unfurlTool.handler(ctx, { slug: "test-post" });
    expectError(result, "No reference URL on post and no url provided");
  });

  it("returns error when neither url nor id/slug", async () => {
    const result = await unfurlTool.handler(ctx, {});
    expectError(result, "Either url or slug is required");
  });

  it("returns UnfurlError message directly", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
    vi.mocked(unfurlUrl).mockRejectedValue(
      new UnfurlError("403 Forbidden", 403),
    );

    const result = await unfurlTool.handler(ctx, {
      slug: "test-post",
      url: "https://blocked.com",
    });
    expectError(result, "403 Forbidden");
  });
});
