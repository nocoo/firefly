import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import { PostService } from "./post-service";
import type { PostWithCategory } from "@/models/types";

// Mock all post entity functions
vi.mock("@/data/entities/post", () => ({
  createPost: vi.fn(),
  updatePost: vi.fn(),
  deletePost: vi.fn(),
  getPostById: vi.fn(),
  getPostBySlug: vi.fn(),
  getPostTags: vi.fn(),
  setPostTags: vi.fn(),
  batchUpdatePosts: vi.fn(),
  refreshCategoryPostCount: vi.fn(),
  refreshAllCategoryPostCounts: vi.fn(),
  refreshAllTagPostCounts: vi.fn(),
  invalidatePostCaches: vi.fn(),
}));

vi.mock("@/data/entities/category", () => ({
  invalidateCategoryCache: vi.fn(),
}));

vi.mock("@/data/entities/tag", () => ({
  invalidateTagCache: vi.fn(),
}));

// Import mocked functions for assertions
import {
  createPost,
  updatePost,
  deletePost,
  getPostById,
  getPostBySlug,
  getPostTags,
  setPostTags,
  batchUpdatePosts,
  refreshCategoryPostCount,
  refreshAllCategoryPostCounts,
  refreshAllTagPostCounts,
} from "@/data/entities/post";

import { invalidateCategoryCache } from "@/data/entities/category";
import { invalidateTagCache } from "@/data/entities/tag";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = Math.floor(Date.now() / 1000);

const samplePost: PostWithCategory = {
  id: "post-1",
  title: "Hello World",
  slug: "hello-world",
  content: "# Hello",
  content_html: "<h1>Hello</h1>",
  excerpt: "Hello",
  status: "published",
  category_id: "cat-1",
  featured_image: null,
  comment_enabled: 1,
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
  category_name: "Tech",
  category_slug: "tech",
};

const sampleTags = [
  { id: "t1", name: "React", slug: "react" },
  { id: "t2", name: "TypeScript", slug: "typescript" },
];

// ---------------------------------------------------------------------------
// PostService.create
// ---------------------------------------------------------------------------

describe("PostService.create", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("creates post, sets tags, and refreshes counts", async () => {
    vi.mocked(createPost).mockResolvedValue(samplePost);
    vi.mocked(setPostTags).mockResolvedValue();
    vi.mocked(refreshCategoryPostCount).mockResolvedValue();
    vi.mocked(refreshAllTagPostCounts).mockResolvedValue();

    const result = await PostService.create(db, {
      title: "Hello World",
      slug: "hello-world",
      content: "# Hello",
      status: "published",
      categoryId: "cat-1",
      tagIds: ["t1", "t2"],
    });

    expect(createPost).toHaveBeenCalledOnce();
    expect(setPostTags).toHaveBeenCalledWith(db, "post-1", ["t1", "t2"]);
    expect(refreshCategoryPostCount).toHaveBeenCalledWith(db, "cat-1");
    expect(refreshAllTagPostCounts).toHaveBeenCalledWith(db);
    expect(invalidateCategoryCache).toHaveBeenCalled();
    expect(invalidateTagCache).toHaveBeenCalled();
    expect(result.title).toBe("Hello World");
  });

  it("skips tag setting when no tagIds provided", async () => {
    vi.mocked(createPost).mockResolvedValue(samplePost);
    vi.mocked(refreshCategoryPostCount).mockResolvedValue();
    vi.mocked(refreshAllTagPostCounts).mockResolvedValue();

    await PostService.create(db, {
      title: "Test",
      slug: "test",
      content: "Content",
      status: "draft",
    });

    expect(setPostTags).not.toHaveBeenCalled();
  });

  it("skips category refresh when no categoryId", async () => {
    vi.mocked(createPost).mockResolvedValue({ ...samplePost, category_id: null });
    vi.mocked(refreshAllTagPostCounts).mockResolvedValue();

    await PostService.create(db, {
      title: "Test",
      slug: "test",
      content: "Content",
      status: "draft",
    });

    expect(refreshCategoryPostCount).not.toHaveBeenCalled();
  });

  it("continues when secondary effects fail (D6: best-effort)", async () => {
    vi.mocked(createPost).mockResolvedValue(samplePost);
    vi.mocked(setPostTags).mockRejectedValue(new Error("tag failure"));
    vi.mocked(refreshCategoryPostCount).mockResolvedValue();
    vi.mocked(refreshAllTagPostCounts).mockResolvedValue();

    // Should NOT throw even though setPostTags failed
    const result = await PostService.create(db, {
      title: "Test",
      slug: "test",
      content: "Content",
      status: "published",
      categoryId: "cat-1",
      tagIds: ["t1"],
    });

    expect(result.title).toBe("Hello World");
  });
});

// ---------------------------------------------------------------------------
// PostService.update
// ---------------------------------------------------------------------------

describe("PostService.update", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("updates post and refreshes counts when category changes", async () => {
    vi.mocked(getPostById).mockResolvedValue(samplePost);
    vi.mocked(updatePost).mockResolvedValue({
      ...samplePost,
      category_id: "cat-2",
    });
    vi.mocked(refreshCategoryPostCount).mockResolvedValue();
    vi.mocked(refreshAllTagPostCounts).mockResolvedValue();

    const result = await PostService.update(db, "post-1", {
      categoryId: "cat-2",
    });

    expect(updatePost).toHaveBeenCalledOnce();
    // Should refresh both old and new category
    expect(refreshCategoryPostCount).toHaveBeenCalledWith(db, "cat-1");
    expect(refreshCategoryPostCount).toHaveBeenCalledWith(db, "cat-2");
    expect(result?.category_id).toBe("cat-2");
  });

  it("refreshes tag counts when status changes", async () => {
    vi.mocked(getPostById).mockResolvedValue({
      ...samplePost,
      status: "draft",
    });
    vi.mocked(updatePost).mockResolvedValue(samplePost);
    vi.mocked(refreshCategoryPostCount).mockResolvedValue();
    vi.mocked(refreshAllTagPostCounts).mockResolvedValue();

    await PostService.update(db, "post-1", { status: "published" });

    expect(refreshAllTagPostCounts).toHaveBeenCalledWith(db);
  });

  it("sets tags when tagIds provided", async () => {
    vi.mocked(getPostById).mockResolvedValue(samplePost);
    vi.mocked(updatePost).mockResolvedValue(samplePost);
    vi.mocked(setPostTags).mockResolvedValue();
    vi.mocked(refreshAllTagPostCounts).mockResolvedValue();

    await PostService.update(db, "post-1", {
      title: "Updated",
      tagIds: ["t1"],
    });

    expect(setPostTags).toHaveBeenCalledWith(db, "post-1", ["t1"]);
    expect(refreshAllTagPostCounts).toHaveBeenCalled();
  });

  it("returns null when post not found", async () => {
    vi.mocked(getPostById).mockResolvedValue(null);

    const result = await PostService.update(db, "nope", { title: "X" });
    expect(result).toBeNull();
    expect(updatePost).not.toHaveBeenCalled();
  });

  it("skips side effects when nothing changed", async () => {
    vi.mocked(getPostById).mockResolvedValue(samplePost);
    vi.mocked(updatePost).mockResolvedValue(samplePost);

    await PostService.update(db, "post-1", { title: "Same" });

    // No category or status change → no refresh
    expect(refreshCategoryPostCount).not.toHaveBeenCalled();
    expect(refreshAllTagPostCounts).not.toHaveBeenCalled();
  });

  it("continues when secondary effects fail (D6)", async () => {
    vi.mocked(getPostById).mockResolvedValue(samplePost);
    vi.mocked(updatePost).mockResolvedValue({
      ...samplePost,
      category_id: "cat-2",
    });
    vi.mocked(refreshCategoryPostCount).mockRejectedValue(
      new Error("refresh failed"),
    );

    const result = await PostService.update(db, "post-1", {
      categoryId: "cat-2",
    });

    expect(result?.category_id).toBe("cat-2");
  });
});

// ---------------------------------------------------------------------------
// PostService.delete
// ---------------------------------------------------------------------------

describe("PostService.delete", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("deletes post and refreshes category/tag counts", async () => {
    vi.mocked(getPostById).mockResolvedValue(samplePost);
    vi.mocked(deletePost).mockResolvedValue(true);
    vi.mocked(refreshCategoryPostCount).mockResolvedValue();
    vi.mocked(refreshAllTagPostCounts).mockResolvedValue();

    const result = await PostService.delete(db, "post-1");

    expect(deletePost).toHaveBeenCalledWith(db, "post-1");
    expect(refreshCategoryPostCount).toHaveBeenCalledWith(db, "cat-1");
    expect(refreshAllTagPostCounts).toHaveBeenCalledWith(db);
    expect(invalidateCategoryCache).toHaveBeenCalled();
    expect(invalidateTagCache).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("returns false when post not found for deletion", async () => {
    vi.mocked(getPostById).mockResolvedValue(null);
    vi.mocked(deletePost).mockResolvedValue(false);

    const result = await PostService.delete(db, "nope");
    expect(result).toBe(false);
  });

  it("skips category refresh when post had no category", async () => {
    vi.mocked(getPostById).mockResolvedValue({
      ...samplePost,
      category_id: null,
    });
    vi.mocked(deletePost).mockResolvedValue(true);
    vi.mocked(refreshAllTagPostCounts).mockResolvedValue();

    await PostService.delete(db, "post-1");

    expect(refreshCategoryPostCount).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PostService.batchUpdate
// ---------------------------------------------------------------------------

describe("PostService.batchUpdate", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("batch updates and refreshes all counts", async () => {
    vi.mocked(batchUpdatePosts).mockResolvedValue(3);
    vi.mocked(refreshAllCategoryPostCounts).mockResolvedValue();
    vi.mocked(refreshAllTagPostCounts).mockResolvedValue();

    const count = await PostService.batchUpdate(
      db,
      ["p1", "p2", "p3"],
      { status: "published" },
    );

    expect(batchUpdatePosts).toHaveBeenCalledWith(
      db,
      ["p1", "p2", "p3"],
      { status: "published" },
    );
    expect(refreshAllCategoryPostCounts).toHaveBeenCalledWith(db);
    expect(refreshAllTagPostCounts).toHaveBeenCalledWith(db);
    expect(invalidateCategoryCache).toHaveBeenCalled();
    expect(invalidateTagCache).toHaveBeenCalled();
    expect(count).toBe(3);
  });

  it("returns 0 for empty ids", async () => {
    vi.mocked(batchUpdatePosts).mockResolvedValue(0);

    const count = await PostService.batchUpdate(db, [], {
      status: "draft",
    });
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// PostService.getWithTags
// ---------------------------------------------------------------------------

describe("PostService.getWithTags", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("returns post with tags", async () => {
    vi.mocked(getPostById).mockResolvedValue(samplePost);
    vi.mocked(getPostTags).mockResolvedValue(sampleTags);

    const result = await PostService.getWithTags(db, "post-1");

    expect(result).not.toBeNull();
    expect(result!.tags).toHaveLength(2);
    expect(result!.tags[0].name).toBe("React");
  });

  it("returns null when post not found", async () => {
    vi.mocked(getPostById).mockResolvedValue(null);

    const result = await PostService.getWithTags(db, "nope");
    expect(result).toBeNull();
    expect(getPostTags).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PostService.getBySlugWithTags
// ---------------------------------------------------------------------------

describe("PostService.getBySlugWithTags", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("returns post with tags by slug", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePost);
    vi.mocked(getPostTags).mockResolvedValue(sampleTags);

    const result = await PostService.getBySlugWithTags(db, "hello-world");

    expect(result).not.toBeNull();
    expect(result!.title).toBe("Hello World");
    expect(result!.tags).toHaveLength(2);
  });

  it("passes status filter to getBySlug", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(samplePost);
    vi.mocked(getPostTags).mockResolvedValue([]);

    await PostService.getBySlugWithTags(db, "hello-world", "published");

    expect(getPostBySlug).toHaveBeenCalledWith(db, "hello-world", "published");
  });

  it("returns null when post not found", async () => {
    vi.mocked(getPostBySlug).mockResolvedValue(null);

    const result = await PostService.getBySlugWithTags(db, "nope");
    expect(result).toBeNull();
  });
});
