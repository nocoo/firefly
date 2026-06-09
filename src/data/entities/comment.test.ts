import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import {
  listCommentsByPost,
  buildCommentTree,
  createComment,
  deleteComment,
} from "./comment";
import type { Comment } from "@/models/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = Math.floor(Date.now() / 1000);

const parentComment: Comment = {
  id: "c1",
  post_id: "post-1",
  parent_id: null,
  author_name: "Alice",
  author_email: "alice@example.com",
  author_url: null,
  content: "Great post!",
  wp_id: null,
  created_at: now,
};

const childComment: Comment = {
  id: "c2",
  post_id: "post-1",
  parent_id: "c1",
  author_name: "Bob",
  author_email: "bob@example.com",
  author_url: null,
  content: "Thanks!",
  wp_id: null,
  created_at: now + 1,
};

const grandchildComment: Comment = {
  id: "c3",
  post_id: "post-1",
  parent_id: "c2",
  author_name: "Carol",
  author_email: "carol@example.com",
  author_url: null,
  content: "Agreed",
  wp_id: null,
  created_at: now + 2,
};

// ---------------------------------------------------------------------------
// listCommentsByPost
// ---------------------------------------------------------------------------

describe("listCommentsByPost", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns comments for a post ordered by created_at", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [parentComment, childComment],
      meta: { changes: 0, duration: 1 },
    });

    const result = await listCommentsByPost(db, "post-1");

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("post_id = ?");
    expect(sql).toContain("ORDER BY created_at ASC");
    expect(params).toEqual(["post-1"]);
    expect(result).toHaveLength(2);
  });

  it("returns empty array when no comments", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    const result = await listCommentsByPost(db, "post-1");
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildCommentTree
// ---------------------------------------------------------------------------

describe("buildCommentTree", () => {
  it("returns empty array for no comments", () => {
    expect(buildCommentTree([])).toEqual([]);
  });

  it("returns flat list for root-level comments", () => {
    const tree = buildCommentTree([parentComment]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("c1");
    expect(tree[0].children).toEqual([]);
  });

  it("builds parent-child relationship", () => {
    const tree = buildCommentTree([parentComment, childComment]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("c1");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe("c2");
  });

  it("builds deeply nested tree", () => {
    const tree = buildCommentTree([parentComment, childComment, grandchildComment]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children[0].id).toBe("c3");
  });

  it("handles orphaned comments (parent_id references missing comment)", () => {
    const orphan: Comment = {
      ...childComment,
      id: "orphan",
      parent_id: "nonexistent",
    };
    const tree = buildCommentTree([orphan]);
    // Orphan becomes a root since parent not found
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("orphan");
  });

  it("preserves all Comment fields in tree nodes", () => {
    const tree = buildCommentTree([parentComment]);
    const node = tree[0];
    expect(node.author_name).toBe("Alice");
    expect(node.content).toBe("Great post!");
    expect(node.post_id).toBe("post-1");
  });

  it("handles multiple root comments", () => {
    const anotherRoot: Comment = {
      ...parentComment,
      id: "c4",
      parent_id: null,
    };
    const tree = buildCommentTree([parentComment, anotherRoot]);
    expect(tree).toHaveLength(2);
  });

  it("handles comments in arbitrary order", () => {
    const tree = buildCommentTree([grandchildComment, parentComment, childComment]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("c1");
    expect(tree[0].children[0].id).toBe("c2");
    expect(tree[0].children[0].children[0].id).toBe("c3");
  });

  it("skips a comment when node lookup unexpectedly fails", () => {
    const getSpy = vi
      .spyOn(Map.prototype, "get")
      .mockImplementationOnce(() => undefined);

    expect(buildCommentTree([parentComment])).toEqual([]);

    getSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// deleteComment
// ---------------------------------------------------------------------------

describe("deleteComment", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns false when comment not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    const result = await deleteComment(db, "nonexistent");
    expect(result).toBe(false);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("deletes comment and updates post comment_count", async () => {
    vi.mocked(db.firstOrNull)
      // First call: find comment
      .mockResolvedValueOnce(parentComment)
      // Second call: count descendants
      .mockResolvedValueOnce({ cnt: 1 });
    vi.mocked(db.execute).mockResolvedValue({ meta: { changes: 1, duration: 1 } } as never);

    const result = await deleteComment(db, "c1");
    expect(result).toBe(true);

    // Should have called DELETE then UPDATE
    expect(db.execute).toHaveBeenCalledTimes(2);

    const [deleteSql, deleteParams] = vi.mocked(db.execute).mock.calls[0];
    expect(deleteSql).toContain("DELETE FROM comments");
    expect(deleteParams).toEqual(["c1"]);

    const [updateSql, updateParams] = vi.mocked(db.execute).mock.calls[1];
    expect(updateSql).toContain("comment_count");
    expect(updateParams).toEqual([1, "post-1"]);
  });

  it("counts multiple descendants for accurate comment_count update", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(parentComment)
      .mockResolvedValueOnce({ cnt: 3 });
    vi.mocked(db.execute).mockResolvedValue({ meta: { changes: 1, duration: 1 } } as never);

    await deleteComment(db, "c1");

    const [, updateParams] = vi.mocked(db.execute).mock.calls[1];
    expect(updateParams).toEqual([3, "post-1"]);
  });

  it("defaults to 1 when count query returns null", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(parentComment)
      .mockResolvedValueOnce(null); // countResult is null
    vi.mocked(db.execute).mockResolvedValue({ meta: { changes: 1, duration: 1 } } as never);

    await deleteComment(db, "c1");

    const [, updateParams] = vi.mocked(db.execute).mock.calls[1];
    expect(updateParams).toEqual([1, "post-1"]);
  });
});

// ---------------------------------------------------------------------------
// createComment
// ---------------------------------------------------------------------------

describe("createComment", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
    vi.mocked(db.execute).mockResolvedValue({
      meta: { changes: 1, duration: 1 },
    } as never);
  });

  it("inserts a top-level comment with null parent and increments post count", async () => {
    const result = await createComment(db, {
      postId: "post-1",
      authorName: "Zheng",
      content: "Nice post.",
    });
    expect(result.post_id).toBe("post-1");
    expect(result.parent_id).toBeNull();
    expect(result.author_email).toBeNull();
    expect(result.author_url).toBeNull();
    expect(result.author_name).toBe("Zheng");
    expect(result.content).toBe("Nice post.");
    expect(result.id).toMatch(/^[0-9a-f-]+$/);
    expect(result.created_at).toBeGreaterThan(0);

    expect(db.execute).toHaveBeenCalledTimes(2);
    // INSERT call carries the same id and params we returned
    const [insertSql, insertParams] = vi.mocked(db.execute).mock.calls[0];
    expect(insertSql).toMatch(/INSERT INTO comments/);
    expect(insertParams?.[0]).toBe(result.id);
    expect(insertParams?.[1]).toBe("post-1");
    expect(insertParams?.[2]).toBeNull(); // parent
    // UPDATE call increments comment_count by 1
    const [updateSql, updateParams] = vi.mocked(db.execute).mock.calls[1];
    expect(updateSql).toMatch(/comment_count \+ 1/);
    expect(updateParams).toEqual(["post-1"]);
  });

  it("threads parentId, email, url through the insert", async () => {
    const result = await createComment(db, {
      postId: "post-1",
      authorName: "Friend",
      content: "Reply",
      parentId: "c-parent",
      authorEmail: "x@y.com",
      authorUrl: "https://example.com",
    });
    expect(result.parent_id).toBe("c-parent");
    expect(result.author_email).toBe("x@y.com");
    expect(result.author_url).toBe("https://example.com");

    const [, insertParams] = vi.mocked(db.execute).mock.calls[0];
    expect(insertParams?.[2]).toBe("c-parent");
    expect(insertParams?.[4]).toBe("x@y.com");
    expect(insertParams?.[5]).toBe("https://example.com");
  });
});
