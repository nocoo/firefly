// ---------------------------------------------------------------------------
// Comment data layer — read-only (historical WordPress comments)
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { Comment, CommentTree } from "@/models/types";

// ---------------------------------------------------------------------------
// listCommentsByPost
// ---------------------------------------------------------------------------

export async function listCommentsByPost(
  db: Db,
  postId: string,
): Promise<Comment[]> {
  const result = await db.query<Comment>(
    "SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC",
    [postId],
  );
  return result.results;
}

// ---------------------------------------------------------------------------
// buildCommentTree — convert flat list to nested tree
// ---------------------------------------------------------------------------

export function buildCommentTree(comments: Comment[]): CommentTree[] {
  const map = new Map<string, CommentTree>();
  const roots: CommentTree[] = [];

  // First pass: create CommentTree nodes
  for (const c of comments) {
    map.set(c.id, { ...c, children: [] });
  }

  // Second pass: build parent-child relationships
  for (const c of comments) {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
