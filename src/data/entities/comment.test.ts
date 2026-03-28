import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import {
  listCommentsByPost,
  buildCommentTree,
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
});
