import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db, DbQueryResult } from "@/lib/db";
import type { Post, PostWithCategory } from "@/models/types";
import {
  listPosts,
  getPostBySlug,
  createPost,
  updatePost,
  deletePost,
  getPostTags,
  setPostTags,
  type CreatePostInput,
  type UpdatePostInput,
} from "./posts";

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

function createMockDb(): Db {
  return {
    query: vi.fn(),
    firstOrNull: vi.fn(),
    execute: vi.fn(),
    batch: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const now = Math.floor(Date.now() / 1000);

const samplePost: Post = {
  id: "01HQ...",
  title: "Test Post",
  slug: "test-post",
  content: "# Hello\n\nWorld",
  content_html: null,
  excerpt: "Hello World",
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

// ---------------------------------------------------------------------------
// listPosts()
// ---------------------------------------------------------------------------

describe("listPosts", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
  });

  it("returns paginated posts with default options", async () => {
    const mockResult: DbQueryResult<PostWithCategory> = {
      results: [samplePostWithCategory],
      meta: { changes: 0, duration: 1 },
    };
    vi.mocked(db.query).mockResolvedValue(mockResult as unknown as DbQueryResult);
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 42 });

    const result = await listPosts(db);

    expect(db.query).toHaveBeenCalledOnce();
    const [sql, _params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("SELECT");
    expect(sql).toContain("LEFT JOIN categories");
    expect(sql).toContain("ORDER BY");
    expect(sql).toContain("LIMIT");
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].title).toBe("Test Post");
    // Verify total comes from COUNT query, not results.length
    expect(result.total).toBe(42);
  });

  it("issues a separate COUNT query for total", async () => {
    vi.mocked(db.query).mockResolvedValue({ results: [samplePostWithCategory], meta: { changes: 0, duration: 0 } });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 100 });

    const result = await listPosts(db, { status: "published" });

    // firstOrNull should be called with a COUNT query
    const [countSql, countParams] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(countSql).toContain("COUNT(*)");
    expect(countSql).toContain("status = ?");
    expect(countParams).toContain("published");
    expect(result.total).toBe(100);
  });

  it("filters by status when specified", async () => {
    vi.mocked(db.query).mockResolvedValue({ results: [], meta: { changes: 0, duration: 0 } });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    await listPosts(db, { status: "published" });

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("status = ?");
    expect(params).toContain("published");
  });

  it("filters by category_id when specified", async () => {
    vi.mocked(db.query).mockResolvedValue({ results: [], meta: { changes: 0, duration: 0 } });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    await listPosts(db, { categoryId: "cat-1" });

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("category_id = ?");
    expect(params).toContain("cat-1");
  });

  it("applies pagination offset and limit", async () => {
    vi.mocked(db.query).mockResolvedValue({ results: [], meta: { changes: 0, duration: 0 } });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    await listPosts(db, { page: 2, pageSize: 10 });

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("LIMIT");
    expect(sql).toContain("OFFSET");
    expect(params).toContain(10); // limit
    expect(params).toContain(10); // offset = (page-1) * pageSize
  });

  it("searches by title when query specified", async () => {
    vi.mocked(db.query).mockResolvedValue({ results: [], meta: { changes: 0, duration: 0 } });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    await listPosts(db, { query: "typescript" });

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("title LIKE ?");
    expect(params).toContain("%typescript%");
  });

  it("filters by tagId when specified", async () => {
    vi.mocked(db.query).mockResolvedValue({ results: [], meta: { changes: 0, duration: 0 } });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    await listPosts(db, { tagId: "tag-1" });

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("post_tags WHERE tag_id = ?");
    expect(params).toContain("tag-1");
  });
});

// ---------------------------------------------------------------------------
// getPostBySlug()
// ---------------------------------------------------------------------------

describe("getPostBySlug", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
  });

  it("returns post with category info when found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(samplePostWithCategory);

    const result = await getPostBySlug(db, "test-post");

    expect(db.firstOrNull).toHaveBeenCalledOnce();
    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("slug = ?");
    expect(params).toEqual(["test-post"]);
    expect(result?.title).toBe("Test Post");
  });

  it("returns null when post not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    const result = await getPostBySlug(db, "nonexistent");

    expect(result).toBeNull();
  });

  it("filters by status when specified", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(samplePostWithCategory);

    await getPostBySlug(db, "test-post", "published");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("p.slug = ?");
    expect(sql).toContain("p.status = ?");
    expect(params).toEqual(["test-post", "published"]);
  });

  it("does not filter by status when not specified", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(samplePostWithCategory);

    await getPostBySlug(db, "test-post");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("slug = ?");
    expect(sql).not.toContain("status = ?");
    expect(params).toEqual(["test-post"]);
  });
});

// ---------------------------------------------------------------------------
// createPost()
// ---------------------------------------------------------------------------

describe("createPost", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
  });

  it("inserts post and returns the created post", async () => {
    const input: CreatePostInput = {
      title: "New Post",
      slug: "new-post",
      content: "# New\n\nContent",
      status: "draft",
      category_id: "cat-1",
    };

    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 5 });
    vi.mocked(db.firstOrNull).mockResolvedValue({
      ...samplePost,
      ...input,
      id: "generated-id",
    });

    const result = await createPost(db, input);

    // First execute should be the INSERT
    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("INSERT INTO posts");
    expect(result.title).toBe("New Post");

    // Should also refresh category post_count
    const categoryRefresh = vi.mocked(db.execute).mock.calls.find(([s]) =>
      s.includes("UPDATE categories SET post_count"),
    );
    expect(categoryRefresh).toBeDefined();
  });

  it("computes reading_time and excerpt automatically", async () => {
    const input: CreatePostInput = {
      title: "Long Post",
      slug: "long-post",
      content: Array(400).fill("word").join(" "),
      status: "draft",
    };

    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 5 });
    vi.mocked(db.firstOrNull).mockResolvedValue({ ...samplePost, ...input });

    await createPost(db, input);

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    // Should include reading_time in the INSERT
    expect(sql).toContain("reading_time");
    expect(params!.length).toBeGreaterThan(0);
  });

  it("sets published_at when status is published", async () => {
    const input: CreatePostInput = {
      title: "Published Post",
      slug: "published-post",
      content: "Content",
      status: "published",
    };

    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 5 });
    vi.mocked(db.firstOrNull).mockResolvedValue({ ...samplePost, ...input });

    await createPost(db, input);

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("published_at");
    // published_at should be a non-null number
    const publishedAt = params!.find(
      (p) => typeof p === "number" && p > 1700000000,
    );
    expect(publishedAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// updatePost()
// ---------------------------------------------------------------------------

describe("updatePost", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
  });

  it("updates specified fields", async () => {
    const input: UpdatePostInput = {
      title: "Updated Title",
      content: "Updated content",
    };

    // firstOrNull calls: 1) getPostById (existing), 2) getPostById (after update)
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce({ ...samplePostWithCategory, ...input });
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });

    const result = await updatePost(db, "test-id", input);

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("UPDATE posts SET");
    expect(sql).toContain("title = ?");
    expect(sql).toContain("content = ?");
    expect(sql).toContain("WHERE id = ?");
    expect(params).toContain("test-id");
    expect(result?.title).toBe("Updated Title");
  });

  it("recomputes reading_time when content changes", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });

    await updatePost(db, "test-id", { content: "new content" });

    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("reading_time");
  });

  it("returns null when post not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    const result = await updatePost(db, "nonexistent", { title: "X" });
    expect(result).toBeNull();
  });

  it("auto-sets published_at when status changes to published", async () => {
    // Call sequence: 1) getPostById (existing, draft, no published_at)
    // then execute (UPDATE), then refreshCategoryPostCount (execute), refreshAllTagPostCounts (execute)
    // then getPostById (after update)
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce({ ...samplePostWithCategory, status: "draft", published_at: null })
      .mockResolvedValueOnce({ ...samplePostWithCategory, status: "published", published_at: now });
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });

    await updatePost(db, "test-id", { status: "published" });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("published_at = ?");
    // Should include a timestamp parameter (a number > 1700000000)
    const publishedAtParam = (params as unknown[]).find(
      (p) => typeof p === "number" && p > 1700000000,
    );
    expect(publishedAtParam).toBeDefined();
  });

  it("does not overwrite existing published_at on re-publish", async () => {
    const existingPublishedAt = 1700000000;
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce({ ...samplePostWithCategory, status: "draft", published_at: existingPublishedAt })
      .mockResolvedValueOnce({ ...samplePostWithCategory, status: "published", published_at: existingPublishedAt });
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });

    await updatePost(db, "test-id", { status: "published" });

    const [sql] = vi.mocked(db.execute).mock.calls[0];
    // Should NOT contain published_at since it already exists
    expect(sql).not.toContain("published_at");
  });

  it("refreshes category post_count when status changes", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce({ ...samplePostWithCategory, status: "draft", category_id: "cat-1" })
      .mockResolvedValueOnce({ ...samplePostWithCategory, status: "published" });
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });

    await updatePost(db, "test-id", { status: "published" });

    // Should have execute calls: UPDATE posts, refreshCategoryPostCount, refreshAllTagPostCounts
    const executeCalls = vi.mocked(db.execute).mock.calls;
    expect(executeCalls.length).toBeGreaterThanOrEqual(2);
    // One of the execute calls should update categories post_count
    const categoryRefresh = executeCalls.find(([sql]) =>
      sql.includes("UPDATE categories SET post_count"),
    );
    expect(categoryRefresh).toBeDefined();
  });

  it("updates featured_image field", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });

    await updatePost(db, "test-id", { featured_image: "https://img.example.com/hero.jpg" });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("featured_image = ?");
    expect(params).toContain("https://img.example.com/hero.jpg");
  });

  it("updates comment_enabled field", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });

    await updatePost(db, "test-id", { comment_enabled: 1 });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("comment_enabled = ?");
    expect(params).toContain(1);
  });

  it("updates published_at when explicitly provided", async () => {
    const explicitDate = 1700000000;
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });

    await updatePost(db, "test-id", { published_at: explicitDate });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("published_at = ?");
    expect(params).toContain(explicitDate);
  });

  it("updates slug field", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce({ ...samplePostWithCategory, slug: "new-slug" });
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });

    const result = await updatePost(db, "test-id", { slug: "new-slug" });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("slug = ?");
    expect(params).toContain("new-slug");
    expect(result?.slug).toBe("new-slug");
  });

  it("updates excerpt field independently", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce({ ...samplePostWithCategory, excerpt: "Custom excerpt" });
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });

    const result = await updatePost(db, "test-id", { excerpt: "Custom excerpt" });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("excerpt = ?");
    expect(params).toContain("Custom excerpt");
    expect(result?.excerpt).toBe("Custom excerpt");
  });

  it("auto-regenerates excerpt when excerpt is null", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce({ ...samplePostWithCategory, content: "Some long content here" })
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });

    await updatePost(db, "test-id", { excerpt: null });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("excerpt = ?");
    // Should have regenerated excerpt from content, not null
    const excerptParam = (params as unknown[]).find(
      (p) => typeof p === "string" && p !== "test-id",
    );
    expect(excerptParam).toBeDefined();
    expect(excerptParam).not.toBeNull();
  });

  it("returns existing post when no fields provided", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(samplePostWithCategory);

    const result = await updatePost(db, "test-id", {});

    // Should call getPostById (firstOrNull) twice: once to check existence, once to return
    // But execute should only be called for getPostById
    expect(result?.title).toBe("Test Post");
  });

  it("clears orphan reference metadata when reference_url is set to null", async () => {
    const existingWithRef: PostWithCategory = {
      ...samplePostWithCategory,
      reference_url: "https://example.com",
      reference_title: "Old Title",
      reference_description: "Old Desc",
      reference_image: "https://example.com/old.jpg",
    };

    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(existingWithRef)
      .mockResolvedValueOnce({
        ...existingWithRef,
        reference_url: null,
        reference_title: null,
        reference_description: null,
        reference_image: null,
      });
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });

    await updatePost(db, "test-id", { reference_url: null });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    // All 4 reference fields should be in the SET clause
    expect(sql).toContain("reference_url = ?");
    expect(sql).toContain("reference_title = ?");
    expect(sql).toContain("reference_description = ?");
    expect(sql).toContain("reference_image = ?");

    // All reference values should be null (4 nulls for url + title + desc + image)
    const nullParams = (params as unknown[]).filter((p) => p === null);
    expect(nullParams.length).toBeGreaterThanOrEqual(4);
  });

  it("does not clear reference metadata when reference_url is not null", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });

    await updatePost(db, "test-id", {
      reference_url: "https://new-example.com",
      reference_title: "New Title",
    });

    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("reference_url = ?");
    expect(sql).toContain("reference_title = ?");
    // Should NOT auto-null description/image when URL is being set (not cleared)
    expect(sql).not.toContain("reference_description = ?");
    expect(sql).not.toContain("reference_image = ?");
  });

  it("refreshes both categories when category changes", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce({ ...samplePostWithCategory, category_id: "cat-old" })
      .mockResolvedValueOnce({ ...samplePostWithCategory, category_id: "cat-new" });
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });

    await updatePost(db, "test-id", { category_id: "cat-new" });

    const executeCalls = vi.mocked(db.execute).mock.calls;
    // Should refresh both old and new category post_count
    const categoryRefreshCalls = executeCalls.filter(([sql]) =>
      sql.includes("UPDATE categories SET post_count"),
    );
    expect(categoryRefreshCalls.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// deletePost()
// ---------------------------------------------------------------------------

describe("deletePost", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
  });

  it("deletes post by id and returns true", async () => {
    // firstOrNull: getPostById before delete
    vi.mocked(db.firstOrNull).mockResolvedValue(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    const result = await deletePost(db, "test-id");

    // First execute call should be the DELETE
    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("DELETE FROM posts");
    expect(sql).toContain("WHERE id = ?");
    expect(params).toEqual(["test-id"]);
    expect(result).toBe(true);
  });

  it("refreshes category post_count after deletion", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ ...samplePostWithCategory, category_id: "cat-1" });
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await deletePost(db, "test-id");

    // Should have execute calls: DELETE, refreshCategoryPostCount, refreshAllTagPostCounts
    const executeCalls = vi.mocked(db.execute).mock.calls;
    expect(executeCalls.length).toBeGreaterThanOrEqual(2);
    const categoryRefresh = executeCalls.find(([sql]) =>
      sql.includes("UPDATE categories SET post_count"),
    );
    expect(categoryRefresh).toBeDefined();
  });

  it("returns false when post not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 1 });

    const result = await deletePost(db, "nonexistent");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getPostTags()
// ---------------------------------------------------------------------------

describe("getPostTags", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
  });

  it("returns tags for a post", async () => {
    const tags = [
      { id: "tag-1", name: "TypeScript", slug: "typescript" },
      { id: "tag-2", name: "React", slug: "react" },
    ];
    vi.mocked(db.query).mockResolvedValue({
      results: tags,
      meta: { changes: 0, duration: 1 },
    });

    const result = await getPostTags(db, "post-1");

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("INNER JOIN post_tags");
    expect(sql).toContain("WHERE pt.post_id = ?");
    expect(params).toEqual(["post-1"]);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("TypeScript");
  });

  it("returns empty array when post has no tags", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    const result = await getPostTags(db, "post-no-tags");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// setPostTags()
// ---------------------------------------------------------------------------

describe("setPostTags", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
  });

  it("replaces tags via batch when tags provided", async () => {
    vi.mocked(db.batch).mockResolvedValue(undefined as never);
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 1 });

    await setPostTags(db, "post-1", ["tag-1", "tag-2"]);

    expect(db.batch).toHaveBeenCalledOnce();
    const [statements] = vi.mocked(db.batch).mock.calls[0];
    // First statement: DELETE existing tags
    expect(statements[0].sql).toContain("DELETE FROM post_tags");
    // Remaining statements: INSERT new tags
    expect(statements).toHaveLength(3); // 1 delete + 2 inserts
  });

  it("only deletes when no tags provided", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 1 });

    await setPostTags(db, "post-1", []);

    // Should use execute (not batch) for single delete statement
    expect(db.batch).not.toHaveBeenCalled();
    expect(db.execute).toHaveBeenCalled();
    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("DELETE FROM post_tags");
  });
});
