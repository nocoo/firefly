import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb, createMockPostWithAgent } from "@/data/core/test-utils";
import type { PostWithAgent } from "@/models/types";

// Mock all post entity functions
vi.mock("@/data/entities/post", () => ({
  createPost: vi.fn(),
  updatePost: vi.fn(),
  deletePost: vi.fn(),
  getPostById: vi.fn(),
  setPostTags: vi.fn(),
  batchUpdatePosts: vi.fn(),
  refreshCategoryPostCount: vi.fn(),
  refreshAllCategoryPostCounts: vi.fn(),
  refreshAllTagPostCounts: vi.fn(),
  invalidatePostCaches: vi.fn(),
  getPostRowid: vi.fn(),
  ftsSync: vi.fn(),
}));

vi.mock("@/data/entities/category", () => ({
  invalidateCategoryCache: vi.fn(),
}));

vi.mock("@/data/entities/tag", () => ({
  invalidateTagCache: vi.fn(),
}));

vi.mock("@/data/entities/human", () => ({
  getDefaultHumanIdUncached: vi.fn(),
}));

// Import mocked functions for assertions
import {
  createPost,
  updatePost,
  deletePost,
  getPostById,
  setPostTags,
  batchUpdatePosts,
  refreshCategoryPostCount,
  refreshAllCategoryPostCounts,
  refreshAllTagPostCounts,
  invalidatePostCaches,
  getPostRowid,
  ftsSync,
} from "@/data/entities/post";

import { invalidateCategoryCache } from "@/data/entities/category";
import { invalidateTagCache } from "@/data/entities/tag";
import { getDefaultHumanIdUncached } from "@/data/entities/human";
import { PostService, PostAttributionError } from "./post-service";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const samplePost = createMockPostWithAgent({
  id: "post-1",
  title: "Hello World",
  slug: "hello-world",
  content: "# Hello",
  content_html: "<h1>Hello</h1>",
  excerpt: "Hello",
  status: "published",
  category_id: "cat-1",
  category_name: "Tech",
  category_slug: "tech",
});

// ---------------------------------------------------------------------------
// PostService.create
// ---------------------------------------------------------------------------

describe("PostService.create", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
    vi.mocked(getDefaultHumanIdUncached).mockResolvedValue("human-default");
  });

  it("creates post, sets tags, and refreshes counts", async () => {
    vi.mocked(createPost).mockResolvedValue(samplePost);
    vi.mocked(setPostTags).mockResolvedValue();
    vi.mocked(refreshCategoryPostCount).mockResolvedValue();
    vi.mocked(refreshAllTagPostCounts).mockResolvedValue();
    vi.mocked(ftsSync).mockResolvedValue();

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
    expect(invalidatePostCaches).toHaveBeenCalled();
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
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

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
    expect(errSpy).toHaveBeenCalled();
  });

  // L104: Cover branch where post.excerpt is null (uses ?? undefined fallback)
  it("handles null excerpt in ftsSync (L104 branch)", async () => {
    const postWithNullExcerpt: PostWithAgent = {
      ...samplePost,
      excerpt: null,
    };
    vi.mocked(createPost).mockResolvedValue(postWithNullExcerpt);
    vi.mocked(refreshCategoryPostCount).mockResolvedValue();
    vi.mocked(refreshAllTagPostCounts).mockResolvedValue();
    vi.mocked(ftsSync).mockResolvedValue();

    await PostService.create(db, {
      title: "Test",
      slug: "test",
      content: "Content",
      status: "published",
      categoryId: "cat-1",
    });

    // ftsSync should be called with excerpt: undefined (via ?? fallback)
    expect(ftsSync).toHaveBeenCalledWith(db, {
      action: "upsert",
      postId: "post-1",
      title: "Test",
      content: "Content",
      excerpt: undefined,
    });
  });

  it.each([
    [undefined, "human-default"],
    ["human-selected", "human-selected"],
  ])("assigns human %s on create", async (humanId, expectedHumanId) => {
    vi.mocked(createPost).mockResolvedValue(samplePost);
    await PostService.create(db, {
      title: "Test",
      slug: "test",
      content: "Content",
      status: "draft",
      humanId,
    });
    expect(createPost).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        humanId: expectedHumanId,
        aiAgentId: undefined,
      }),
    );
    if (humanId) expect(getDefaultHumanIdUncached).not.toHaveBeenCalled();
  });

  it("keeps agent-only create without a human", async () => {
    vi.mocked(createPost).mockResolvedValue(samplePost);
    await PostService.create(db, {
      title: "Test",
      slug: "test",
      content: "Content",
      status: "draft",
      aiAgentId: "agent-1",
    });
    expect(createPost).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ humanId: undefined, aiAgentId: "agent-1" }),
    );
    expect(getDefaultHumanIdUncached).not.toHaveBeenCalled();
  });

  it("rejects create with both human and agent", async () => {
    await expect(
      PostService.create(db, {
        title: "Test",
        slug: "test",
        content: "Content",
        status: "draft",
        humanId: "human-1",
        aiAgentId: "agent-1",
      }),
    ).rejects.toBeInstanceOf(PostAttributionError);
    expect(createPost).not.toHaveBeenCalled();
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
    vi.mocked(getDefaultHumanIdUncached).mockResolvedValue("human-default");
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
    expect(invalidatePostCaches).toHaveBeenCalled();
    expect(result?.category_id).toBe("cat-2");
  });

  it("skips extra tag refresh when status changes AND tagIds explicitly provided", async () => {
    vi.mocked(getPostById).mockResolvedValue({
      ...samplePost,
      status: "draft",
    });
    vi.mocked(updatePost).mockResolvedValue(samplePost);
    vi.mocked(setPostTags).mockResolvedValue();
    vi.mocked(refreshAllTagPostCounts).mockResolvedValue();
    vi.mocked(refreshCategoryPostCount).mockResolvedValue();

    await PostService.update(db, "post-1", {
      status: "published",
      tagIds: ["tag-1"],
    });

    // refreshAllTagPostCounts should fire exactly once (from the tagIds branch),
    // not twice — the statusChanged block must skip its own refresh.
    expect(refreshAllTagPostCounts).toHaveBeenCalledTimes(1);
  });

  it("skips extra category refresh when status changes AND category also changes", async () => {
    vi.mocked(getPostById).mockResolvedValue({
      ...samplePost,
      status: "draft",
      category_id: "cat-old",
    });
    vi.mocked(updatePost).mockResolvedValue(samplePost);
    vi.mocked(refreshCategoryPostCount).mockResolvedValue();
    vi.mocked(refreshAllTagPostCounts).mockResolvedValue();

    await PostService.update(db, "post-1", {
      status: "published",
      categoryId: "cat-new",
    });

    // The category-changed branch already refreshes both old and new categories.
    // The statusChanged block must skip its own categoryId refresh — so the
    // total number of refreshCategoryPostCount calls is 2 (old + new), not 3.
    expect(refreshCategoryPostCount).toHaveBeenCalledTimes(2);
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
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await PostService.update(db, "post-1", {
      categoryId: "cat-2",
    });

    expect(result?.category_id).toBe("cat-2");
    expect(errSpy).toHaveBeenCalled();
  });

  // L148: Cover branch where input.categoryId is null (explicitly set)
  it("refreshes new category with null when moving to no category (L148 branch)", async () => {
    vi.mocked(getPostById).mockResolvedValue(samplePost); // has category_id: "cat-1"
    vi.mocked(updatePost).mockResolvedValue({
      ...samplePost,
      category_id: null,
    });
    vi.mocked(refreshCategoryPostCount).mockResolvedValue();
    vi.mocked(ftsSync).mockResolvedValue();

    // Explicitly set categoryId to null (removing category)
    await PostService.update(db, "post-1", {
      categoryId: null,
    });

    // Should refresh both old (cat-1) and new (null) categories
    expect(refreshCategoryPostCount).toHaveBeenCalledWith(db, "cat-1"); // old
    expect(refreshCategoryPostCount).toHaveBeenCalledWith(db, null); // new (L148: ?? null)
  });

  it("refreshes tag and category counts when only status changes", async () => {
    vi.mocked(getPostById).mockResolvedValue({
      ...samplePost,
      status: "draft",
    });
    vi.mocked(updatePost).mockResolvedValue(samplePost);
    vi.mocked(refreshCategoryPostCount).mockResolvedValue();
    vi.mocked(refreshAllTagPostCounts).mockResolvedValue();
    vi.mocked(ftsSync).mockResolvedValue();

    await PostService.update(db, "post-1", { status: "published" });

    expect(refreshAllTagPostCounts).toHaveBeenCalledWith(db);
    expect(refreshCategoryPostCount).toHaveBeenCalledWith(db, "cat-1");
  });

  // L177: Cover branch where updatePost returns null
  it("skips ftsSync when updatePost returns null (L177 branch)", async () => {
    vi.mocked(getPostById).mockResolvedValue(samplePost);
    vi.mocked(updatePost).mockResolvedValue(null);
    vi.mocked(ftsSync).mockResolvedValue();

    const result = await PostService.update(db, "post-1", { title: "New Title" });

    expect(result).toBeNull();
    // L177: if (updated) is false, so ftsSync should not be called
    expect(ftsSync).not.toHaveBeenCalled();
  });

  // L184: Cover branch where updated.excerpt is null (uses ?? undefined fallback)
  it("handles null excerpt in ftsSync during update (L184 branch)", async () => {
    const postWithNullExcerpt: PostWithAgent = {
      ...samplePost,
      excerpt: null,
    };
    vi.mocked(getPostById).mockResolvedValue(samplePost);
    vi.mocked(updatePost).mockResolvedValue(postWithNullExcerpt);
    vi.mocked(ftsSync).mockResolvedValue();

    await PostService.update(db, "post-1", { title: "New Title" });

    // ftsSync should be called with excerpt: undefined (via ?? fallback)
    expect(ftsSync).toHaveBeenCalledWith(db, {
      action: "upsert",
      postId: "post-1",
      title: "Hello World",
      content: "# Hello",
      excerpt: undefined,
    });
  });

  it.each([
    { aiAgentId: null },
    { humanId: null },
  ])("restores default human when clearing attribution with %j", async (input) => {
    vi.mocked(getPostById).mockResolvedValue({
      ...samplePost,
      ai_agent_id: "agent-1",
      human_id: null,
    });
    vi.mocked(updatePost).mockResolvedValue(samplePost);

    await PostService.update(db, "post-1", input);

    expect(updatePost).toHaveBeenCalledWith(
      db,
      "post-1",
      expect.objectContaining({
        humanId: "human-default",
        aiAgentId: null,
      }),
    );
  });

  it("clears humanId when assigning an agent", async () => {
    vi.mocked(getPostById).mockResolvedValue({
      ...samplePost,
      human_id: "human-1",
      ai_agent_id: null,
    });
    vi.mocked(updatePost).mockResolvedValue(samplePost);

    await PostService.update(db, "post-1", { aiAgentId: "agent-9" });

    expect(updatePost).toHaveBeenCalledWith(
      db,
      "post-1",
      expect.objectContaining({ humanId: null, aiAgentId: "agent-9" }),
    );
  });

  it("rejects update with both human and agent set", async () => {
    vi.mocked(getPostById).mockResolvedValue(samplePost);
    await expect(
      PostService.update(db, "post-1", {
        humanId: "human-1",
        aiAgentId: "agent-1",
      }),
    ).rejects.toBeInstanceOf(PostAttributionError);
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
    vi.mocked(getPostRowid).mockResolvedValue(42);
    vi.mocked(deletePost).mockResolvedValue(true);
    vi.mocked(refreshCategoryPostCount).mockResolvedValue();
    vi.mocked(refreshAllTagPostCounts).mockResolvedValue();
    vi.mocked(ftsSync).mockResolvedValue();

    const result = await PostService.delete(db, "post-1");

    expect(deletePost).toHaveBeenCalledWith(db, "post-1");
    expect(refreshCategoryPostCount).toHaveBeenCalledWith(db, "cat-1");
    expect(refreshAllTagPostCounts).toHaveBeenCalledWith(db);
    expect(invalidateCategoryCache).toHaveBeenCalled();
    expect(invalidateTagCache).toHaveBeenCalled();
    expect(ftsSync).toHaveBeenCalledWith(db, { action: "delete", rowid: 42 });
    expect(result).toBe(true);
  });

  it("returns false when post not found for deletion", async () => {
    vi.mocked(getPostById).mockResolvedValue(null);
    vi.mocked(getPostRowid).mockResolvedValue(null);
    vi.mocked(deletePost).mockResolvedValue(false);

    const result = await PostService.delete(db, "nope");
    expect(result).toBe(false);
  });

  it("skips category refresh when post had no category", async () => {
    vi.mocked(getPostById).mockResolvedValue({
      ...samplePost,
      category_id: null,
    });
    vi.mocked(getPostRowid).mockResolvedValue(99);
    vi.mocked(deletePost).mockResolvedValue(true);
    vi.mocked(refreshAllTagPostCounts).mockResolvedValue();
    vi.mocked(ftsSync).mockResolvedValue();

    await PostService.delete(db, "post-1");

    expect(refreshCategoryPostCount).not.toHaveBeenCalled();
  });

  // L222: Cover branch where rowid is null (skips ftsSync)
  it("skips ftsSync when rowid is null (L222 branch)", async () => {
    vi.mocked(getPostById).mockResolvedValue(samplePost);
    vi.mocked(getPostRowid).mockResolvedValue(null);
    vi.mocked(deletePost).mockResolvedValue(true);
    vi.mocked(refreshCategoryPostCount).mockResolvedValue();
    vi.mocked(refreshAllTagPostCounts).mockResolvedValue();

    await PostService.delete(db, "post-1");

    // L222: rowid is null, so ftsSync should NOT be called
    expect(ftsSync).not.toHaveBeenCalled();
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
