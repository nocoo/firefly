import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import {
  listPosts,
  getPostBySlug,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  getPostTags,
  getPostsTagsMap,
  setPostTags,
  batchUpdatePosts,
  refreshCategoryPostCount,
  refreshAllCategoryPostCounts,
  refreshAllTagPostCounts,
  listMonthlyArchives,
  listPostYears,
  getAdjacentPosts,
  invalidatePostCaches,
  getPostRowid,
  searchPosts,
  ftsSync,
} from "./post";
import type { Post, PostWithCategory } from "@/models/types";

// Mock markdown rendering and content enrichment
vi.mock("@/models/post", () => ({
  readingTime: vi.fn().mockReturnValue(3),
  excerptFromContent: vi.fn().mockReturnValue("Auto excerpt..."),
}));

vi.mock("@/models/markdown", () => ({
  renderMarkdown: vi.fn().mockReturnValue("<p>rendered</p>"),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = Math.floor(Date.now() / 1000);

const samplePost: Post = {
  id: "post-1",
  title: "Hello World",
  slug: "hello-world",
  content: "# Hello\n\nWorld",
  content_html: "<h1>Hello</h1><p>World</p>",
  excerpt: "Hello World",
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
};

const samplePostWithCategory: PostWithCategory = {
  ...samplePost,
  category_name: "Tech",
  category_slug: "tech",
};

// ---------------------------------------------------------------------------
// listPosts
// ---------------------------------------------------------------------------

describe("listPosts", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
    invalidatePostCaches();
  });

  it("returns paginated posts with default options", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [samplePostWithCategory],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 1 });

    const result = await listPosts(db);

    expect(result.posts).toHaveLength(1);
    expect(result.total).toBe(1);
    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("LEFT JOIN categories");
    expect(sql).toContain("ORDER BY");
    expect(sql).toContain("LIMIT");
  });

  it("filters by status", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    await listPosts(db, { status: "draft" });

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("p.status = ?");
    expect(params).toContain("draft");
  });

  it("filters by categoryId", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    await listPosts(db, { categoryId: "cat-1" });

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("p.category_id = ?");
    expect(params).toContain("cat-1");
  });

  it("filters by tagId via subquery", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    await listPosts(db, { tagId: "tag-1" });

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("post_tags");
    expect(params).toContain("tag-1");
  });

  it("filters by search query", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    await listPosts(db, { query: "hello" });

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("LIKE");
    expect(params).toContain("%hello%");
  });

  it("filters by archiveYear and archiveMonth", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    await listPosts(db, { archiveYear: 2026, archiveMonth: 3 });

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("strftime");
    expect(params).toContain(2026);
    expect(params).toContain(3);
  });

  it("supports pagination", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 50 });

    const result = await listPosts(db, { page: 2, pageSize: 10 });

    expect(result.total).toBe(50);
    const params = vi.mocked(db.query).mock.calls[0][1]!;
    // pageSize and offset should be in params
    expect(params).toContain(10); // pageSize
    expect(params).toContain(10); // offset = (2-1)*10
  });

  it("supports sortBy created_at", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    await listPosts(db, { sortBy: "created_at" });

    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("p.created_at DESC");
  });

  it("uses count cache on second call", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [samplePostWithCategory],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 1 });

    await listPosts(db);
    await listPosts(db);

    // firstOrNull (count query) should be called once due to cache
    expect(db.firstOrNull).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// getPostBySlug
// ---------------------------------------------------------------------------

describe("getPostBySlug", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns post with category via viewQuery", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(samplePostWithCategory);
    const result = await getPostBySlug(db, "hello-world");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("LEFT JOIN categories");
    expect(sql).toContain("p.slug = ?");
    expect(params).toEqual(["hello-world"]);
    expect(result?.category_name).toBe("Tech");
  });

  it("filters by status when provided", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(samplePostWithCategory);
    await getPostBySlug(db, "hello-world", "published");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("p.status = ?");
    expect(params).toContain("published");
  });

  it("returns null when not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    expect(await getPostBySlug(db, "nope")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getPostById
// ---------------------------------------------------------------------------

describe("getPostById", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns post with category via viewQuery", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(samplePostWithCategory);
    const result = await getPostById(db, "post-1");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("LEFT JOIN categories");
    expect(sql).toContain("p.id = ?");
    expect(params).toEqual(["post-1"]);
    expect(result?.title).toBe("Hello World");
  });

  it("returns null when not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    expect(await getPostById(db, "nope")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createPost
// ---------------------------------------------------------------------------

describe("createPost", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("inserts post with computed fields and returns it", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue(samplePostWithCategory);

    const result = await createPost(db, {
      title: "Hello World",
      slug: "hello-world",
      content: "# Hello\n\nWorld",
      status: "published",
      categoryId: "cat-1",
    });

    expect(db.execute).toHaveBeenCalledOnce();
    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("INSERT INTO posts");
    expect(result.title).toBe("Hello World");
  });

  it("computes readingTime, contentHtml, excerpt on create", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue(samplePostWithCategory);

    await createPost(db, {
      title: "Test",
      slug: "test",
      content: "Some content",
      status: "draft",
    });

    const params = vi.mocked(db.execute).mock.calls[0][1]!;
    // content_html should be rendered
    expect(params).toContain("<p>rendered</p>");
    // reading_time should be computed
    expect(params).toContain(3);
    // excerpt should be auto-generated
    expect(params).toContain("Auto excerpt...");
  });

  it("uses provided excerpt over auto-generated", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue(samplePostWithCategory);

    await createPost(db, {
      title: "Test",
      slug: "test",
      content: "Some content",
      status: "draft",
      excerpt: "My custom excerpt",
    });

    const params = vi.mocked(db.execute).mock.calls[0][1]!;
    expect(params).toContain("My custom excerpt");
  });

  it("auto-sets publishedAt when status is published", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue(samplePostWithCategory);

    await createPost(db, {
      title: "Test",
      slug: "test",
      content: "Some content",
      status: "published",
    });

    const params = vi.mocked(db.execute).mock.calls[0][1]!;
    // publishedAt should be a number (epoch timestamp)
    const publishedAtParam = params.find(
      (p) => typeof p === "number" && p > now - 10 && p !== 3,
    );
    expect(publishedAtParam).toBeDefined();
  });

  it("does not set publishedAt for drafts", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue(samplePostWithCategory);

    await createPost(db, {
      title: "Test",
      slug: "test",
      content: "Some content",
      status: "draft",
    });

    // published_at column should be null
    const params = vi.mocked(db.execute).mock.calls[0][1]!;
    const sql = vi.mocked(db.execute).mock.calls[0][0];
    // Find the index of published_at in the SQL columns
    const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/);
    if (colMatch) {
      const cols = colMatch[1].split(",").map((c: string) => c.trim());
      const pubIdx = cols.indexOf("published_at");
      if (pubIdx >= 0) {
        expect(params[pubIdx]).toBeNull();
      }
    }
  });

  it("defaults commentEnabled to 0", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue(samplePostWithCategory);

    await createPost(db, {
      title: "Test",
      slug: "test",
      content: "Content",
      status: "draft",
    });

    const params = vi.mocked(db.execute).mock.calls[0][1]!;
    // comment_enabled should be 0 (default)
    expect(params).toContain(0);
  });
});

// ---------------------------------------------------------------------------
// updatePost
// ---------------------------------------------------------------------------

describe("updatePost", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("updates specified fields", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory) // existing fetch
      .mockResolvedValueOnce({ ...samplePostWithCategory, title: "Updated" }); // refetch
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    const result = await updatePost(db, "post-1", { title: "Updated" });

    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("UPDATE posts SET");
    expect(result?.title).toBe("Updated");
  });

  it("recomputes readingTime and contentHtml when content changes", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updatePost(db, "post-1", { content: "New content" });

    const params = vi.mocked(db.execute).mock.calls[0][1]!;
    expect(params).toContain("<p>rendered</p>"); // contentHtml
    expect(params).toContain(3); // readingTime
  });

  it("auto-generates excerpt when content changes and no explicit excerpt", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updatePost(db, "post-1", { content: "New content" });

    const params = vi.mocked(db.execute).mock.calls[0][1]!;
    expect(params).toContain("Auto excerpt...");
  });

  it("regenerates excerpt when excerpt is null", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updatePost(db, "post-1", { excerpt: null });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("excerpt = ?");
    expect(params).toContain("Auto excerpt...");
  });

  it("clears reference metadata when referenceUrl is null", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce({
        ...samplePostWithCategory,
        reference_url: "https://example.com",
        reference_title: "Example",
        reference_description: "Desc",
        reference_image: "img.png",
      })
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updatePost(db, "post-1", { referenceUrl: null });

    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("reference_url = ?");
    expect(sql).toContain("reference_title = ?");
    expect(sql).toContain("reference_description = ?");
    expect(sql).toContain("reference_image = ?");
  });

  it("auto-sets publishedAt when transitioning to published", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce({ ...samplePostWithCategory, status: "draft", published_at: null })
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updatePost(db, "post-1", { status: "published" });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("published_at = ?");
    // The published_at param should be a recent epoch timestamp
    const pubAt = params!.find(
      (p) => typeof p === "number" && p > now - 10 && p !== 3,
    );
    expect(pubAt).toBeDefined();
  });

  it("auto-sets publishedAt when already published but date is null", async () => {
    // Scenario: post is already published but published_at is missing (e.g., data inconsistency)
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce({ ...samplePostWithCategory, status: "published", published_at: null })
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    // Update without passing status — final status remains "published"
    await updatePost(db, "post-1", { title: "Updated Title" });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("published_at = ?");
    // The published_at param should be a recent epoch timestamp
    const pubAt = params!.find(
      (p) => typeof p === "number" && p > now - 10,
    );
    expect(pubAt).toBeDefined();
  });

  it("does not overwrite existing publishedAt when updating published post", async () => {
    const existingPubAt = 1700000000;
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce({ ...samplePostWithCategory, status: "published", published_at: existingPubAt })
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updatePost(db, "post-1", { title: "Updated Title" });

    const [sql] = vi.mocked(db.execute).mock.calls[0];
    // Should NOT contain published_at since it already has a value
    expect(sql).not.toContain("published_at = ?");
  });

  it("allows explicitly setting publishedAt to null", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce({ ...samplePostWithCategory, status: "draft", published_at: 1700000000 })
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updatePost(db, "post-1", { publishedAt: null });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("published_at = ?");
    expect(params).toContain(null);
  });

  it("allows explicitly setting publishedAt to a custom timestamp", async () => {
    const customPubAt = 1600000000;
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce({ ...samplePostWithCategory, status: "draft", published_at: null })
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updatePost(db, "post-1", { status: "published", publishedAt: customPubAt });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("published_at = ?");
    expect(params).toContain(customPubAt);
    // Should only have one published_at clause (the explicit one, not auto-set)
    expect(sql.match(/published_at = \?/g)?.length).toBe(1);
  });

  it("returns null when post not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    const result = await updatePost(db, "nope", { title: "X" });
    expect(result).toBeNull();
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("returns existing when no fields provided", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(samplePostWithCategory);
    const result = await updatePost(db, "post-1", {});
    expect(db.execute).not.toHaveBeenCalled();
    expect(result?.title).toBe("Hello World");
  });
});

// ---------------------------------------------------------------------------
// deletePost
// ---------------------------------------------------------------------------

describe("deletePost", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("deletes and returns true", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });
    expect(await deletePost(db, "post-1")).toBe(true);

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("DELETE FROM posts");
    expect(params).toEqual(["post-1"]);
  });

  it("returns false when not found", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 0 });
    expect(await deletePost(db, "nope")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getPostTags
// ---------------------------------------------------------------------------

describe("getPostTags", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns tags for a post", async () => {
    const tags = [
      { id: "t1", name: "React", slug: "react" },
      { id: "t2", name: "TypeScript", slug: "typescript" },
    ];
    vi.mocked(db.query).mockResolvedValue({
      results: tags,
      meta: { changes: 0, duration: 1 },
    });

    const result = await getPostTags(db, "post-1");

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("INNER JOIN post_tags");
    expect(params).toEqual(["post-1"]);
    expect(result).toHaveLength(2);
  });

  it("returns empty array when no tags", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    const result = await getPostTags(db, "post-1");
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getPostsTagsMap — batch fetch tags for multiple posts
// ---------------------------------------------------------------------------

describe("getPostsTagsMap", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns a map of post IDs to tags", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [
        { post_id: "p1", id: "t1", name: "React", slug: "react" },
        { post_id: "p1", id: "t2", name: "TypeScript", slug: "typescript" },
        { post_id: "p2", id: "t1", name: "React", slug: "react" },
      ],
      meta: { changes: 0, duration: 1 },
    });

    const result = await getPostsTagsMap(db, ["p1", "p2", "p3"]);

    expect(result.get("p1")).toEqual([
      { id: "t1", name: "React", slug: "react" },
      { id: "t2", name: "TypeScript", slug: "typescript" },
    ]);
    expect(result.get("p2")).toEqual([
      { id: "t1", name: "React", slug: "react" },
    ]);
    expect(result.get("p3")).toBeUndefined();
  });

  it("returns empty map for empty input", async () => {
    const result = await getPostsTagsMap(db, []);
    expect(result.size).toBe(0);
    expect(db.query).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// setPostTags (D4: pure batch, NO count refresh)
// ---------------------------------------------------------------------------

describe("setPostTags", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("deletes old and inserts new tags via batch", async () => {
    vi.mocked(db.batch).mockResolvedValue([
      { results: [], meta: { changes: 1, duration: 1 } },
      { results: [], meta: { changes: 1, duration: 1 } },
      { results: [], meta: { changes: 1, duration: 1 } },
    ]);

    await setPostTags(db, "post-1", ["tag-1", "tag-2"]);

    expect(db.batch).toHaveBeenCalledOnce();
    const stmts = vi.mocked(db.batch).mock.calls[0][0];
    expect(stmts[0].sql).toContain("DELETE FROM post_tags");
    expect(stmts[1].sql).toContain("INSERT INTO post_tags");
    expect(stmts[2].sql).toContain("INSERT INTO post_tags");
  });

  it("only deletes when tagIds is empty", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    await setPostTags(db, "post-1", []);

    expect(db.execute).toHaveBeenCalledOnce();
    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("DELETE FROM post_tags");
    expect(db.batch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// batchUpdatePosts (D4: pure, NO side effects)
// ---------------------------------------------------------------------------

describe("batchUpdatePosts", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("updates status for multiple posts", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 3, duration: 5 });

    const count = await batchUpdatePosts(db, ["p1", "p2", "p3"], {
      status: "published",
    });

    expect(count).toBe(3);
    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("UPDATE posts SET");
    expect(sql).toContain("status = ?");
    expect(sql).toContain("IN (?, ?, ?)");
  });

  it("auto-sets publishedAt with COALESCE for published status", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await batchUpdatePosts(db, ["p1"], { status: "published" });

    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("COALESCE(published_at, ?)");
  });

  it("updates categoryId", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 2, duration: 3 });

    const count = await batchUpdatePosts(db, ["p1", "p2"], {
      categoryId: "cat-new",
    });

    expect(count).toBe(2);
    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("category_id = ?");
    expect(params).toContain("cat-new");
  });

  it("returns 0 for empty ids", async () => {
    const count = await batchUpdatePosts(db, [], { status: "draft" });
    expect(count).toBe(0);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("returns 0 when no fields to update", async () => {
    const count = await batchUpdatePosts(db, ["p1"], {});
    expect(count).toBe(0);
    expect(db.execute).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// refreshCategoryPostCount
// ---------------------------------------------------------------------------

describe("refreshCategoryPostCount", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("updates category post_count from published posts", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await refreshCategoryPostCount(db, "cat-1");

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("UPDATE categories");
    expect(sql).toContain("COUNT(*)");
    expect(sql).toContain("status = 'published'");
    expect(params).toContain("cat-1");
  });

  it("is a no-op for null categoryId", async () => {
    await refreshCategoryPostCount(db, null);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("is a no-op for undefined categoryId", async () => {
    await refreshCategoryPostCount(db, undefined);
    expect(db.execute).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// refreshAllCategoryPostCounts
// ---------------------------------------------------------------------------

describe("refreshAllCategoryPostCounts", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("updates all categories post_count", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 5, duration: 3 });

    await refreshAllCategoryPostCounts(db);

    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("UPDATE categories");
    expect(sql).toContain("post_count");
  });
});

// ---------------------------------------------------------------------------
// refreshAllTagPostCounts
// ---------------------------------------------------------------------------

describe("refreshAllTagPostCounts", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("updates all tag post_count from published posts", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 5, duration: 3 });

    await refreshAllTagPostCounts(db);

    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("UPDATE tags");
    expect(sql).toContain("post_count");
    expect(sql).toContain("published");
  });
});

// ---------------------------------------------------------------------------
// listMonthlyArchives
// ---------------------------------------------------------------------------

describe("listMonthlyArchives", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
    invalidatePostCaches();
  });

  it("returns archives grouped by year/month", async () => {
    const archives = [
      { year: 2026, month: 3, count: 5 },
      { year: 2026, month: 2, count: 3 },
    ];
    vi.mocked(db.query).mockResolvedValue({
      results: archives,
      meta: { changes: 0, duration: 1 },
    });

    const result = await listMonthlyArchives(db);

    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("strftime");
    expect(sql).toContain("GROUP BY");
    expect(result).toHaveLength(2);
    expect(result[0].year).toBe(2026);
  });

  it("caches results on second call", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [{ year: 2026, month: 3, count: 5 }],
      meta: { changes: 0, duration: 1 },
    });

    await listMonthlyArchives(db);
    await listMonthlyArchives(db);
    expect(db.query).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// listPostYears
// ---------------------------------------------------------------------------

describe("listPostYears", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns distinct years with counts", async () => {
    const years = [
      { year: 2026, count: 10 },
      { year: 2025, count: 5 },
    ];
    vi.mocked(db.query).mockResolvedValue({
      results: years,
      meta: { changes: 0, duration: 1 },
    });

    const result = await listPostYears(db);

    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("strftime");
    expect(sql).toContain("created_at");
    expect(sql).toContain("GROUP BY");
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// getAdjacentPosts
// ---------------------------------------------------------------------------

describe("getAdjacentPosts", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns prev and next posts", async () => {
    const prevPost = { slug: "older", title: "Older Post", published_at: now - 100 };
    const nextPost = { slug: "newer", title: "Newer Post", published_at: now + 100 };

    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(prevPost)
      .mockResolvedValueOnce(nextPost);

    const result = await getAdjacentPosts(db, now, "post-1");

    expect(result.prev?.slug).toBe("older");
    expect(result.next?.slug).toBe("newer");
    expect(db.firstOrNull).toHaveBeenCalledTimes(2);
  });

  it("returns null for missing adjacent posts", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    const result = await getAdjacentPosts(db, now, "post-1");

    expect(result.prev).toBeNull();
    expect(result.next).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// invalidatePostCaches
// ---------------------------------------------------------------------------

describe("invalidatePostCaches", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
    invalidatePostCaches();
  });

  it("clears all caches so next call hits DB", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [{ year: 2026, month: 3, count: 5 }],
      meta: { changes: 0, duration: 1 },
    });

    await listMonthlyArchives(db);
    invalidatePostCaches();
    await listMonthlyArchives(db);

    expect(db.query).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// getPostRowid
// ---------------------------------------------------------------------------

describe("getPostRowid", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("returns rowid when post exists", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue({ rowid: 42 });

    const result = await getPostRowid(db, "post-1");

    expect(result).toBe(42);
    expect(db.firstOrNull).toHaveBeenCalledWith(
      "SELECT rowid FROM posts WHERE id = ?",
      ["post-1"],
    );
  });

  it("returns null when post not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    const result = await getPostRowid(db, "nonexistent");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// searchPosts
// ---------------------------------------------------------------------------

describe("searchPosts", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("calls Worker FTS search endpoint with correct params", async () => {
    const mockResult = {
      posts: [samplePostWithCategory],
      snippets: { "post-1": "Hello <mark>World</mark>" },
      total: 1,
      page: 1,
      pageSize: 20,
    };
    vi.mocked(db.call).mockResolvedValue(mockResult);

    const result = await searchPosts(db, { query: "hello" });

    expect(db.call).toHaveBeenCalledWith("/api/v1/fts-search", {
      query: "hello",
      status: "published",
      page: 1,
      pageSize: 20,
    });
    expect(result.posts).toHaveLength(1);
    expect(result.snippets["post-1"]).toBe("Hello <mark>World</mark>");
    expect(result.total).toBe(1);
  });

  it("passes custom status, page, and pageSize", async () => {
    vi.mocked(db.call).mockResolvedValue({
      posts: [],
      snippets: {},
      total: 0,
      page: 2,
      pageSize: 10,
    });

    await searchPosts(db, {
      query: "test",
      status: "draft",
      page: 2,
      pageSize: 10,
    });

    expect(db.call).toHaveBeenCalledWith("/api/v1/fts-search", {
      query: "test",
      status: "draft",
      page: 2,
      pageSize: 10,
    });
  });

  it("omits status when null (searches all statuses)", async () => {
    vi.mocked(db.call).mockResolvedValue({
      posts: [],
      snippets: {},
      total: 0,
      page: 1,
      pageSize: 10,
    });

    await searchPosts(db, {
      query: "admin search",
      status: null,
      pageSize: 10,
    });

    expect(db.call).toHaveBeenCalledWith("/api/v1/fts-search", {
      query: "admin search",
      page: 1,
      pageSize: 10,
    });
    // Ensure status key is not present at all
    const callArgs = vi.mocked(db.call).mock.calls[0][1] as Record<string, unknown>;
    expect("status" in callArgs).toBe(false);
  });

  it("uses default values for optional params", async () => {
    vi.mocked(db.call).mockResolvedValue({
      posts: [],
      snippets: {},
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await searchPosts(db, { query: "edge computing" });

    expect(db.call).toHaveBeenCalledWith("/api/v1/fts-search", {
      query: "edge computing",
      status: "published",
      page: 1,
      pageSize: 20,
    });
  });

  it("clamps NaN page to default", async () => {
    vi.mocked(db.call).mockResolvedValue({
      posts: [],
      snippets: {},
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await searchPosts(db, { query: "test", page: NaN });

    expect(db.call).toHaveBeenCalledWith("/api/v1/fts-search", {
      query: "test",
      status: "published",
      page: 1,
      pageSize: 20,
    });
  });

  it("clamps negative page to default", async () => {
    vi.mocked(db.call).mockResolvedValue({
      posts: [],
      snippets: {},
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await searchPosts(db, { query: "test", page: -1, pageSize: 0 });

    expect(db.call).toHaveBeenCalledWith("/api/v1/fts-search", {
      query: "test",
      status: "published",
      page: 1,
      pageSize: 20,
    });
  });

  it("clamps oversized pageSize to max 100", async () => {
    vi.mocked(db.call).mockResolvedValue({
      posts: [],
      snippets: {},
      total: 0,
      page: 1,
      pageSize: 100,
    });

    await searchPosts(db, { query: "test", pageSize: 999 });

    expect(db.call).toHaveBeenCalledWith("/api/v1/fts-search", {
      query: "test",
      status: "published",
      page: 1,
      pageSize: 100,
    });
  });
});

// ---------------------------------------------------------------------------
// ftsSync
// ---------------------------------------------------------------------------

describe("ftsSync", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("calls fts-sync endpoint for upsert", async () => {
    vi.mocked(db.call).mockResolvedValue({ ok: true });

    await ftsSync(db, {
      action: "upsert",
      postId: "post-1",
      title: "Hello",
      content: "World",
      excerpt: "Hi",
    });

    expect(db.call).toHaveBeenCalledWith("/api/v1/fts-sync", {
      action: "upsert",
      postId: "post-1",
      title: "Hello",
      content: "World",
      excerpt: "Hi",
    });
  });

  it("calls fts-sync endpoint for delete", async () => {
    vi.mocked(db.call).mockResolvedValue({ ok: true });

    await ftsSync(db, { action: "delete", rowid: 42 });

    expect(db.call).toHaveBeenCalledWith("/api/v1/fts-sync", {
      action: "delete",
      rowid: 42,
    });
  });
});

// ---------------------------------------------------------------------------
// Branch coverage: countCacheGet/countCacheSet (lines 130, 141, 144)
// ---------------------------------------------------------------------------

describe("count cache branches", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
    invalidatePostCaches();
  });

  it("evicts expired cache entry (line 130 - cache TTL expired)", async () => {
    // First call populates cache
    vi.mocked(db.query).mockResolvedValue({
      results: [samplePostWithCategory],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 10 });

    await listPosts(db);
    expect(db.firstOrNull).toHaveBeenCalledOnce();

    // Mock Date.now to simulate time passing beyond TTL (5 minutes = 300000ms)
    const originalDateNow = Date.now;
    vi.spyOn(Date, "now").mockReturnValue(originalDateNow() + 6 * 60 * 1000);

    // Second call should hit DB again due to expired cache
    await listPosts(db);
    expect(db.firstOrNull).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });

  it("evicts oldest entry when cache is full (lines 141, 144)", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 1 });

    // Fill cache with 65 different queries (COUNT_MAX_SIZE = 64)
    // Each query needs a different WHERE clause to create a unique cache key
    // Use different categoryId values to create unique cache keys
    for (let i = 0; i < 65; i++) {
      await listPosts(db, { categoryId: `cat-${i}` });
    }

    // Should have called firstOrNull 65 times (no cache hits, all different keys)
    expect(db.firstOrNull).toHaveBeenCalledTimes(65);
  });
});

// ---------------------------------------------------------------------------
// Branch coverage: listPosts sort/filter branches
// ---------------------------------------------------------------------------

describe("listPosts branch coverage", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
    invalidatePostCaches();
  });

  it("applies ASC sort direction (line 225)", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    await listPosts(db, { sortBy: "published_at", sortOrder: "asc" });

    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("p.published_at ASC");
  });

  it("sorts by comment_count", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    await listPosts(db, { sortBy: "comment_count" });

    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("p.comment_count DESC");
  });

  it("sorts by view_count", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    await listPosts(db, { sortBy: "view_count" });

    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("p.view_count DESC");
  });

  it("sorts by title", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    await listPosts(db, { sortBy: "title" });

    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("p.title DESC");
  });

  it("falls back to created_at for unknown sortBy (line 233)", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    // Force an invalid sortBy value via type assertion
    await listPosts(db, { sortBy: "invalid_field" as "created_at" });

    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("p.created_at DESC");
  });

  it("filters by archiveYear only without archiveMonth (line 213 false branch)", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    await listPosts(db, { archiveYear: 2026 });

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("strftime('%Y'");
    expect(params).toContain(2026);
    // Should not contain month filter
    expect(sql).not.toContain("strftime('%m'");
  });

  it("uses results.length as fallback when count is null (line 261)", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [samplePostWithCategory, samplePostWithCategory],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    const result = await listPosts(db);

    expect(result.total).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Branch coverage: createPost error branch (line 354)
// ---------------------------------------------------------------------------

describe("createPost branch coverage", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
  });

  it("throws error when post cannot be retrieved after creation (line 354)", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    // Return null when trying to fetch the newly created post
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    await expect(
      createPost(db, {
        title: "Test",
        slug: "test",
        content: "Content",
        status: "draft",
      }),
    ).rejects.toThrow("Failed to retrieve Post");
  });

  it("uses provided publishedAt when status is published", async () => {
    const customPubAt = 1600000000;
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 3 });
    vi.mocked(db.firstOrNull).mockResolvedValue(samplePostWithCategory);

    await createPost(db, {
      title: "Test",
      slug: "test",
      content: "Content",
      status: "published",
      publishedAt: customPubAt,
    });

    const params = vi.mocked(db.execute).mock.calls[0][1]!;
    expect(params).toContain(customPubAt);
  });
});

// ---------------------------------------------------------------------------
// Branch coverage: updatePost additional branches
// ---------------------------------------------------------------------------

describe("updatePost branch coverage", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
  });

  it("updates slug when provided (line 378)", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce({ ...samplePostWithCategory, slug: "new-slug" });
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    const result = await updatePost(db, "post-1", { slug: "new-slug" });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("slug = ?");
    expect(params).toContain("new-slug");
    expect(result?.slug).toBe("new-slug");
  });

  it("uses explicit non-null excerpt over auto-generated (line 404)", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updatePost(db, "post-1", { excerpt: "Custom excerpt" });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("excerpt = ?");
    expect(params).toContain("Custom excerpt");
  });

  it("regenerates excerpt from new content when excerpt is null (line 402-403)", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updatePost(db, "post-1", {
      content: "New content here",
      excerpt: null,
    });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("excerpt = ?");
    expect(params).toContain("Auto excerpt...");
  });

  it("updates categoryId when provided", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updatePost(db, "post-1", { categoryId: "cat-new" });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("category_id = ?");
    expect(params).toContain("cat-new");
  });

  it("sets categoryId to null when explicitly passed", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce({ ...samplePostWithCategory, category_id: null });
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updatePost(db, "post-1", { categoryId: null });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("category_id = ?");
    expect(params).toContain(null);
  });

  it("updates featuredImage when provided", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updatePost(db, "post-1", { featuredImage: "new-image.jpg" });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("featured_image = ?");
    expect(params).toContain("new-image.jpg");
  });

  it("sets featuredImage to null when explicitly passed", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce({ ...samplePostWithCategory, featured_image: "old.jpg" })
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updatePost(db, "post-1", { featuredImage: null });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("featured_image = ?");
    expect(params).toContain(null);
  });

  it("updates referenceUrl when provided", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updatePost(db, "post-1", { referenceUrl: "https://example.com/ref" });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("reference_url = ?");
    expect(params).toContain("https://example.com/ref");
  });

  it("preserves reference metadata when explicitly set alongside null referenceUrl (lines 431-443)", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce({
        ...samplePostWithCategory,
        reference_url: "https://old.com",
        reference_title: "Old Title",
      })
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    // Explicitly set referenceTitle when clearing referenceUrl
    await updatePost(db, "post-1", {
      referenceUrl: null,
      referenceTitle: "Keep This Title",
    });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    // reference_title should be "Keep This Title", not null
    expect(params).toContain("Keep This Title");
    // reference_description and reference_image should be null (auto-cleared)
    expect(sql).toContain("reference_description = ?");
    expect(sql).toContain("reference_image = ?");
  });

  it("updates referenceTitle when provided", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updatePost(db, "post-1", { referenceTitle: "New Title" });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("reference_title = ?");
    expect(params).toContain("New Title");
  });

  it("updates referenceDescription when provided", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updatePost(db, "post-1", { referenceDescription: "New Desc" });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("reference_description = ?");
    expect(params).toContain("New Desc");
  });

  it("updates referenceImage when provided", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updatePost(db, "post-1", { referenceImage: "ref-image.png" });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("reference_image = ?");
    expect(params).toContain("ref-image.png");
  });

  it("updates commentEnabled when provided", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    await updatePost(db, "post-1", { commentEnabled: 1 });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("comment_enabled = ?");
    expect(params).toContain(1);
  });

  it("does not auto-generate excerpt when content changes with explicit excerpt (line 393 false)", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(samplePostWithCategory)
      .mockResolvedValueOnce(samplePostWithCategory);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 2 });

    // Update content AND provide explicit excerpt
    await updatePost(db, "post-1", {
      content: "New content",
      excerpt: "My explicit excerpt",
    });

    const params = vi.mocked(db.execute).mock.calls[0][1]!;
    // Should use explicit excerpt, not auto-generated
    expect(params).toContain("My explicit excerpt");
    expect(params).not.toContain("Auto excerpt...");
  });
});

// ---------------------------------------------------------------------------
// Branch coverage: searchPosts edge cases
// ---------------------------------------------------------------------------

describe("searchPosts branch coverage", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
  });

  it("floors pageSize to integer", async () => {
    vi.mocked(db.call).mockResolvedValue({
      posts: [],
      snippets: {},
      total: 0,
      page: 1,
      pageSize: 15,
    });

    await searchPosts(db, { query: "test", pageSize: 15.9 });

    expect(db.call).toHaveBeenCalledWith("/api/v1/fts-search", {
      query: "test",
      status: "published",
      page: 1,
      pageSize: 15,
    });
  });

  it("floors page to integer", async () => {
    vi.mocked(db.call).mockResolvedValue({
      posts: [],
      snippets: {},
      total: 0,
      page: 2,
      pageSize: 20,
    });

    await searchPosts(db, { query: "test", page: 2.8 });

    expect(db.call).toHaveBeenCalledWith("/api/v1/fts-search", {
      query: "test",
      status: "published",
      page: 2,
      pageSize: 20,
    });
  });

  it("handles Infinity page by falling back to default", async () => {
    vi.mocked(db.call).mockResolvedValue({
      posts: [],
      snippets: {},
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await searchPosts(db, { query: "test", page: Infinity });

    expect(db.call).toHaveBeenCalledWith("/api/v1/fts-search", {
      query: "test",
      status: "published",
      page: 1,
      pageSize: 20,
    });
  });

  it("handles Infinity pageSize by falling back to default", async () => {
    vi.mocked(db.call).mockResolvedValue({
      posts: [],
      snippets: {},
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await searchPosts(db, { query: "test", pageSize: Infinity });

    expect(db.call).toHaveBeenCalledWith("/api/v1/fts-search", {
      query: "test",
      status: "published",
      page: 1,
      pageSize: 20,
    });
  });
});
