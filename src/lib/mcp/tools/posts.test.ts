import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import type { Post, PostWithCategory, Tag } from "@/models/types";
import {
  handleListPosts,
  handleGetPost,
  handleCreatePost,
  handleUpdatePost,
  handleDeletePost,
  handleGenerateExcerpt,
  handleUnfurlReference,
  type ToolContext,
} from "./posts";

// ---------------------------------------------------------------------------
// Mock data layer
// ---------------------------------------------------------------------------

vi.mock("@/data/posts", () => ({
  listPosts: vi.fn(),
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
  getPostBySlug,
  createPost,
  updatePost,
  deletePost,
  getPostTags,
  setPostTags,
} from "@/data/posts";

import { generateExcerpt } from "@/services/ai";
import { summarizeUnfurl } from "@/services/ai";
import { unfurlUrl } from "@/services/unfurl";

function createMockDb(): Db {
  return {
    query: vi.fn(),
    firstOrNull: vi.fn(),
    execute: vi.fn(),
    batch: vi.fn(),
  };
}

const now = Math.floor(Date.now() / 1000);

const samplePost: Post = {
  id: "post-1",
  title: "Test Post",
  slug: "test-post",
  content: "# Hello",
  content_html: null,
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

describe("handleListPosts", () => {
  let ctx: ToolContext;
  beforeEach(() => {
    ctx = { db: createMockDb() };
    vi.mocked(listPosts).mockReset();
  });

  it("returns posts with total count", async () => {
    vi.mocked(listPosts).mockResolvedValue({
      posts: [samplePostWithCategory],
      total: 1,
    });

    const result = await handleListPosts(ctx, {});

    expect(listPosts).toHaveBeenCalledWith(ctx.db, expect.objectContaining({
      page: 1,
      pageSize: 20,
    }));
    const data = JSON.parse(result.content[0].text);
    expect(data.posts).toHaveLength(1);
    expect(data.total).toBe(1);
  });

  it("passes filters correctly", async () => {
    vi.mocked(listPosts).mockResolvedValue({ posts: [], total: 0 });

    await handleListPosts(ctx, {
      status: "draft",
      category_id: "cat-1",
      page: 2,
      page_size: 10,
    });

    expect(listPosts).toHaveBeenCalledWith(ctx.db, expect.objectContaining({
      status: "draft",
      categoryId: "cat-1",
      page: 2,
      pageSize: 10,
    }));
  });
});

describe("handleGetPost", () => {
  let ctx: ToolContext;
  beforeEach(() => {
    ctx = { db: createMockDb() };
    vi.mocked(getPostBySlug).mockReset();
    vi.mocked(getPostTags).mockReset();
  });

  it("returns post with tags when found", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
    vi.mocked(getPostTags).mockResolvedValue(sampleTags);

    const result = await handleGetPost(ctx, { slug: "test-post" });

    expect(getPostBySlug).toHaveBeenCalledWith(ctx.db, "test-post");
    const data = JSON.parse(result.content[0].text);
    expect(data.title).toBe("Test Post");
    expect(data.tags).toHaveLength(1);
  });

  it("returns error for missing post", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(null);

    const result = await handleGetPost(ctx, { slug: "missing" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });
});

describe("handleCreatePost", () => {
  let ctx: ToolContext;
  beforeEach(() => {
    ctx = { db: createMockDb() };
    vi.mocked(createPost).mockReset();
    vi.mocked(setPostTags).mockReset();
  });

  it("creates post with default status draft", async () => {
    vi.mocked(createPost).mockResolvedValue(samplePost);

    const result = await handleCreatePost(ctx, {
      title: "New Post",
      slug: "new-post",
      content: "Hello",
    });

    expect(createPost).toHaveBeenCalledWith(ctx.db, expect.objectContaining({
      title: "New Post",
      slug: "new-post",
      status: "draft",
    }));
    expect(result.content[0].text).toContain("Test Post"); // returns mock
  });

  it("sets tags when provided", async () => {
    vi.mocked(createPost).mockResolvedValue(samplePost);
    vi.mocked(setPostTags).mockResolvedValue(undefined);

    await handleCreatePost(ctx, {
      title: "Tagged Post",
      slug: "tagged",
      content: "Content",
      tag_ids: ["tag-1", "tag-2"],
    });

    expect(setPostTags).toHaveBeenCalledWith(ctx.db, "post-1", ["tag-1", "tag-2"]);
  });

  it("skips setPostTags when no tag_ids", async () => {
    vi.mocked(createPost).mockResolvedValue(samplePost);

    await handleCreatePost(ctx, {
      title: "No Tags",
      slug: "no-tags",
      content: "Content",
    });

    expect(setPostTags).not.toHaveBeenCalled();
  });

  it("rolls back post when setPostTags fails", async () => {
    vi.mocked(createPost).mockResolvedValue(samplePost);
    vi.mocked(setPostTags).mockRejectedValue(new Error("FK constraint"));
    vi.mocked(deletePost).mockResolvedValue(true);

    const result = await handleCreatePost(ctx, {
      title: "Bad Tags",
      slug: "bad-tags",
      content: "Content",
      tag_ids: ["nonexistent-tag"],
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("rolled back");
    expect(deletePost).toHaveBeenCalledWith(ctx.db, "post-1");
  });
});

describe("handleUpdatePost", () => {
  let ctx: ToolContext;
  beforeEach(() => {
    ctx = { db: createMockDb() };
    vi.mocked(getPostBySlug).mockReset();
    vi.mocked(updatePost).mockReset();
    vi.mocked(setPostTags).mockReset();
  });

  it("updates existing post", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
    vi.mocked(updatePost).mockResolvedValue(samplePostWithCategory);

    const result = await handleUpdatePost(ctx, {
      slug: "test-post",
      title: "Updated Title",
    });

    expect(updatePost).toHaveBeenCalledWith(ctx.db, "post-1", expect.objectContaining({
      title: "Updated Title",
    }));
    expect(result.content[0].text).toContain("Test Post");
  });

  it("returns error for missing post", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(null);

    const result = await handleUpdatePost(ctx, { slug: "missing" });

    expect(result.isError).toBe(true);
  });

  it("writes tags before updating post fields", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
    vi.mocked(getPostTags).mockResolvedValue(sampleTags);
    vi.mocked(updatePost).mockResolvedValue(samplePostWithCategory);
    vi.mocked(setPostTags).mockResolvedValue(undefined);

    const callOrder: string[] = [];
    vi.mocked(setPostTags).mockImplementation(async () => { callOrder.push("setPostTags"); });
    vi.mocked(updatePost).mockImplementation(async () => { callOrder.push("updatePost"); return samplePostWithCategory; });

    await handleUpdatePost(ctx, {
      slug: "test-post",
      title: "New Title",
      tag_ids: ["tag-1"],
    });

    expect(setPostTags).toHaveBeenCalledWith(ctx.db, "post-1", ["tag-1"]);
    expect(updatePost).toHaveBeenCalled();
    expect(callOrder).toEqual(["setPostTags", "updatePost"]);
  });

  it("does not update post fields when setPostTags fails", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
    vi.mocked(getPostTags).mockResolvedValue(sampleTags);
    vi.mocked(setPostTags).mockRejectedValue(new Error("FK constraint"));

    await expect(handleUpdatePost(ctx, {
      slug: "test-post",
      title: "New Title",
      tag_ids: ["nonexistent-tag"],
    })).rejects.toThrow("FK constraint");

    // updatePost must NOT have been called — post fields are untouched
    expect(updatePost).not.toHaveBeenCalled();
  });

  it("restores original tags when updatePost fails", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
    vi.mocked(getPostTags).mockResolvedValue([
      { id: "old-tag-1", name: "Old", slug: "old" },
    ]);
    vi.mocked(setPostTags).mockResolvedValue(undefined);
    vi.mocked(updatePost).mockRejectedValue(new Error("UNIQUE constraint failed: posts.slug"));

    await expect(handleUpdatePost(ctx, {
      slug: "test-post",
      new_slug: "duplicate-slug",
      tag_ids: ["new-tag-1"],
    })).rejects.toThrow("UNIQUE constraint");

    // setPostTags should be called twice: once with new tags, once to restore old
    expect(setPostTags).toHaveBeenCalledTimes(2);
    expect(setPostTags).toHaveBeenNthCalledWith(1, ctx.db, "post-1", ["new-tag-1"]);
    expect(setPostTags).toHaveBeenNthCalledWith(2, ctx.db, "post-1", ["old-tag-1"]);
  });

  it("passes excerpt: null to data layer to trigger auto-regeneration", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
    vi.mocked(updatePost).mockResolvedValue(samplePostWithCategory);

    await handleUpdatePost(ctx, {
      slug: "test-post",
      excerpt: null,
    });

    expect(updatePost).toHaveBeenCalledWith(ctx.db, "post-1", expect.objectContaining({
      excerpt: null,
    }));
  });
});

describe("handleDeletePost", () => {
  let ctx: ToolContext;
  beforeEach(() => {
    ctx = { db: createMockDb() };
    vi.mocked(getPostBySlug).mockReset();
    vi.mocked(deletePost).mockReset();
  });

  it("deletes existing post", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
    vi.mocked(deletePost).mockResolvedValue(true);

    const result = await handleDeletePost(ctx, { slug: "test-post" });

    expect(deletePost).toHaveBeenCalledWith(ctx.db, "post-1");
    const data = JSON.parse(result.content[0].text);
    expect(data.deleted).toBe(true);
  });

  it("returns error for missing post", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(null);

    const result = await handleDeletePost(ctx, { slug: "missing" });

    expect(result.isError).toBe(true);
  });
});

describe("handleGenerateExcerpt", () => {
  let ctx: ToolContext;
  beforeEach(() => {
    ctx = { db: createMockDb() };
    vi.mocked(getPostBySlug).mockReset();
    vi.mocked(generateExcerpt).mockReset();
  });

  it("generates excerpt for existing post", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
    vi.mocked(generateExcerpt).mockResolvedValue("AI generated excerpt");

    const result = await handleGenerateExcerpt(ctx, { slug: "test-post" });

    expect(generateExcerpt).toHaveBeenCalledWith("Test Post", "# Hello");
    const data = JSON.parse(result.content[0].text);
    expect(data.excerpt).toBe("AI generated excerpt");
    expect(data.slug).toBe("test-post");
  });

  it("returns error for missing post", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(null);

    const result = await handleGenerateExcerpt(ctx, { slug: "missing" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("returns error when AI is not configured", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
    vi.mocked(generateExcerpt).mockRejectedValue(new Error("AI not configured"));

    const result = await handleGenerateExcerpt(ctx, { slug: "test-post" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("AI provider not configured");
  });

  it("returns error on LLM failure", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
    vi.mocked(generateExcerpt).mockRejectedValue(new Error("API timeout"));

    const result = await handleGenerateExcerpt(ctx, { slug: "test-post" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Excerpt generation failed");
    expect(result.content[0].text).toContain("API timeout");
  });
});

// ---------------------------------------------------------------------------
// handleUnfurlReference
// ---------------------------------------------------------------------------

describe("handleUnfurlReference", () => {
  let ctx: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = { db: createMockDb() };
  });

  it("returns error when neither url nor slug is provided", async () => {
    const result = await handleUnfurlReference(ctx, {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Either url or slug is required");
  });

  it("unfurls a URL without slug (preview mode)", async () => {
    vi.mocked(unfurlUrl).mockResolvedValue({
      url: "https://example.com",
      ogTitle: "Example",
      ogDescription: "Example site",
      ogImage: "https://example.com/img.jpg",
      pageTitle: "Example Page",
      bodyText: "Body text",
      readmeImage: null,
    });
    vi.mocked(summarizeUnfurl).mockResolvedValue({
      title: "AI Title",
      description: "AI Description",
    });

    const result = await handleUnfurlReference(ctx, { url: "https://example.com" });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.url).toBe("https://example.com");
    expect(data.title).toBe("AI Title");
    expect(data.description).toBe("AI Description");
    expect(data.image).toBe("https://example.com/img.jpg");
    expect(data.ai_enhanced).toBe(true);
  });

  it("falls back to OG data when AI returns null", async () => {
    vi.mocked(unfurlUrl).mockResolvedValue({
      url: "https://example.com",
      ogTitle: "OG Title",
      ogDescription: "OG Description",
      ogImage: null,
      pageTitle: null,
      bodyText: "Body",
      readmeImage: null,
    });
    vi.mocked(summarizeUnfurl).mockResolvedValue(null);

    const result = await handleUnfurlReference(ctx, { url: "https://example.com" });

    const data = JSON.parse(result.content[0].text);
    expect(data.title).toBe("OG Title");
    expect(data.description).toBe("OG Description");
    expect(data.ai_enhanced).toBe(false);
  });

  it("unfurls and saves to post when slug is provided", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue({
      ...samplePostWithCategory,
      reference_url: "https://example.com",
    });
    vi.mocked(unfurlUrl).mockResolvedValue({
      url: "https://example.com",
      ogTitle: "Example",
      ogDescription: "Desc",
      ogImage: null,
      pageTitle: null,
      bodyText: "Body",
      readmeImage: null,
    });
    vi.mocked(summarizeUnfurl).mockResolvedValue(null);
    vi.mocked(updatePost).mockResolvedValue(samplePostWithCategory);

    const result = await handleUnfurlReference(ctx, { slug: "test-post" });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.saved).toBe(true);
    expect(updatePost).toHaveBeenCalledWith(
      ctx.db,
      samplePost.id,
      expect.objectContaining({
        reference_url: "https://example.com",
        reference_title: "Example",
      }),
    );
  });

  it("returns error when slug provided but post not found", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(null);

    const result = await handleUnfurlReference(ctx, { slug: "nonexistent" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Post not found");
  });

  it("returns error when slug provided but no URL anywhere", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue({
      ...samplePostWithCategory,
      reference_url: null,
    });

    const result = await handleUnfurlReference(ctx, { slug: "test-post" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No reference URL on post");
  });

  it("uses provided url over post's reference_url when both exist", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue({
      ...samplePostWithCategory,
      reference_url: "https://old.example.com",
    });
    vi.mocked(unfurlUrl).mockResolvedValue({
      url: "https://new.example.com",
      ogTitle: "New",
      ogDescription: "New desc",
      ogImage: null,
      pageTitle: null,
      bodyText: "Body",
      readmeImage: null,
    });
    vi.mocked(summarizeUnfurl).mockResolvedValue(null);
    vi.mocked(updatePost).mockResolvedValue(samplePostWithCategory);

    const result = await handleUnfurlReference(ctx, {
      slug: "test-post",
      url: "https://new.example.com",
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.url).toBe("https://new.example.com");
    expect(updatePost).toHaveBeenCalledWith(
      ctx.db,
      samplePost.id,
      expect.objectContaining({
        reference_url: "https://new.example.com",
      }),
    );
  });

  it("returns error when unfurl fails with UnfurlError (preview mode)", async () => {
    const { UnfurlError } = await import("@/services/unfurl");
    vi.mocked(unfurlUrl).mockRejectedValue(new UnfurlError("URL not allowed: private network", 400));

    const result = await handleUnfurlReference(ctx, { url: "http://localhost" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("private network");
  });

  it("returns error when unfurl fails with generic error (preview mode)", async () => {
    vi.mocked(unfurlUrl).mockRejectedValue(new Error("Network timeout"));

    const result = await handleUnfurlReference(ctx, { url: "https://example.com" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unfurl failed");
    expect(result.content[0].text).toContain("Network timeout");
  });

  it("returns error when unfurl fails with UnfurlError (slug mode)", async () => {
    const { UnfurlError } = await import("@/services/unfurl");
    vi.mocked(getPostBySlug).mockResolvedValue({
      ...samplePostWithCategory,
      reference_url: "http://localhost",
    });
    vi.mocked(unfurlUrl).mockRejectedValue(new UnfurlError("URL not allowed: private network", 400));

    const result = await handleUnfurlReference(ctx, { slug: "test-post" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("private network");
  });

  it("returns error when unfurl fails with generic error (slug mode)", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue({
      ...samplePostWithCategory,
      reference_url: "https://example.com",
    });
    vi.mocked(unfurlUrl).mockRejectedValue(new Error("Connection refused"));

    const result = await handleUnfurlReference(ctx, { slug: "test-post" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unfurl failed");
    expect(result.content[0].text).toContain("Connection refused");
  });

  it("falls back to hostname when no ogTitle/pageTitle (preview mode)", async () => {
    vi.mocked(unfurlUrl).mockResolvedValue({
      url: "https://example.com",
      ogTitle: null,
      ogDescription: null,
      ogImage: null,
      pageTitle: null,
      bodyText: "Body",
      readmeImage: null,
    });
    vi.mocked(summarizeUnfurl).mockResolvedValue(null);

    const result = await handleUnfurlReference(ctx, { url: "https://example.com" });

    const data = JSON.parse(result.content[0].text);
    expect(data.title).toBe("example.com");
    expect(data.description).toBe("");
  });

  it("falls back to readmeImage when ogImage is null (preview mode)", async () => {
    vi.mocked(unfurlUrl).mockResolvedValue({
      url: "https://github.com/owner/repo",
      ogTitle: "Repo",
      ogDescription: "Desc",
      ogImage: null,
      pageTitle: null,
      bodyText: "Body",
      readmeImage: "https://raw.githubusercontent.com/owner/repo/main/img.png",
    });
    vi.mocked(summarizeUnfurl).mockResolvedValue(null);

    const result = await handleUnfurlReference(ctx, { url: "https://github.com/owner/repo" });

    const data = JSON.parse(result.content[0].text);
    expect(data.image).toBe("https://raw.githubusercontent.com/owner/repo/main/img.png");
  });

  it("returns error with non-Error throw (preview mode)", async () => {
    vi.mocked(unfurlUrl).mockRejectedValue("string thrown");

    const result = await handleUnfurlReference(ctx, { url: "https://example.com" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unfurl failed");
    expect(result.content[0].text).toContain("string thrown");
  });

  it("returns error with non-Error throw (slug mode)", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue({
      ...samplePostWithCategory,
      reference_url: "https://example.com",
    });
    vi.mocked(unfurlUrl).mockRejectedValue("string thrown");

    const result = await handleUnfurlReference(ctx, { slug: "test-post" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unfurl failed");
    expect(result.content[0].text).toContain("string thrown");
  });
});
