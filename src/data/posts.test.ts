import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db, DbQueryResult } from "@/lib/db";
import type { Post, PostWithCategory } from "@/models/types";
import {
  listPosts,
  getPostBySlug,
  createPost,
  updatePost,
  deletePost,
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
