import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import type { Post, PostWithCategory, Tag } from "@/models/types";
import {
  handleListPosts,
  handleGetPost,
  handleCreatePost,
  handleUpdatePost,
  handleDeletePost,
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

import {
  listPosts,
  getPostBySlug,
  createPost,
  updatePost,
  deletePost,
  getPostTags,
  setPostTags,
} from "@/data/posts";

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

  it("updates tags when tag_ids provided", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePostWithCategory);
    vi.mocked(updatePost).mockResolvedValue(samplePostWithCategory);
    vi.mocked(setPostTags).mockResolvedValue(undefined);

    await handleUpdatePost(ctx, {
      slug: "test-post",
      tag_ids: ["tag-1"],
    });

    expect(setPostTags).toHaveBeenCalledWith(ctx.db, "post-1", ["tag-1"]);
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
