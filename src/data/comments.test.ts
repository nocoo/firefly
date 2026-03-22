import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import type { Comment } from "@/models/types";
import { listCommentsByPost, buildCommentTree } from "./comments";

function createMockDb(): Db {
  return {
    query: vi.fn(),
    firstOrNull: vi.fn(),
    execute: vi.fn(),
    batch: vi.fn(),
  };
}

const now = Math.floor(Date.now() / 1000);

const sampleComments: Comment[] = [
  {
    id: "c1",
    post_id: "p1",
    parent_id: null,
    author_name: "Alice",
    author_email: "alice@test.com",
    author_url: null,
    content: "Great post!",
    wp_id: 1,
    created_at: now - 3600,
  },
  {
    id: "c2",
    post_id: "p1",
    parent_id: "c1",
    author_name: "Bob",
    author_email: null,
    author_url: "https://bob.dev",
    content: "Thanks Alice!",
    wp_id: 2,
    created_at: now - 1800,
  },
  {
    id: "c3",
    post_id: "p1",
    parent_id: null,
    author_name: "Charlie",
    author_email: null,
    author_url: null,
    content: "Interesting read.",
    wp_id: 3,
    created_at: now,
  },
  {
    id: "c4",
    post_id: "p1",
    parent_id: "c2",
    author_name: "Alice",
    author_email: "alice@test.com",
    author_url: null,
    content: "You're welcome!",
    wp_id: 4,
    created_at: now - 900,
  },
];

// ---------------------------------------------------------------------------
// listCommentsByPost
// ---------------------------------------------------------------------------

describe("listCommentsByPost", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("queries comments by post_id ordered by created_at", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: sampleComments,
      meta: { changes: 0, duration: 1 },
    });

    const result = await listCommentsByPost(db, "p1");

    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("post_id = ?");
    expect(sql).toContain("ORDER BY");
    expect(params).toEqual(["p1"]);
    expect(result).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// buildCommentTree
// ---------------------------------------------------------------------------

describe("buildCommentTree", () => {
  it("builds a tree from flat comments", () => {
    const tree = buildCommentTree(sampleComments);

    // Should have 2 top-level comments (c1 and c3)
    expect(tree).toHaveLength(2);
    expect(tree[0].id).toBe("c1");
    expect(tree[1].id).toBe("c3");
  });

  it("nests children correctly", () => {
    const tree = buildCommentTree(sampleComments);

    // c1 has child c2
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe("c2");

    // c2 has child c4
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].id).toBe("c4");
  });

  it("returns empty array for no comments", () => {
    expect(buildCommentTree([])).toEqual([]);
  });

  it("handles single-level comments (no parents)", () => {
    const flat: Comment[] = [
      { ...sampleComments[0], parent_id: null },
      { ...sampleComments[2], parent_id: null },
    ];
    const tree = buildCommentTree(flat);
    expect(tree).toHaveLength(2);
    expect(tree[0].children).toHaveLength(0);
    expect(tree[1].children).toHaveLength(0);
  });
});
