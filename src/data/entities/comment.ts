// ---------------------------------------------------------------------------
// Comment entity — read + delete
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
    const node = map.get(c.id);
    if (!node) continue;
    const parent = c.parent_id ? map.get(c.parent_id) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ---------------------------------------------------------------------------
// deleteComment — delete a comment and all descendants, update post count
// ---------------------------------------------------------------------------

export async function deleteComment(
  db: Db,
  commentId: string,
): Promise<boolean> {
  // 1. Get comment to find post_id
  const comment = await db.firstOrNull<Comment>(
    "SELECT * FROM comments WHERE id = ?",
    [commentId],
  );
  if (!comment) return false;

  // 2. Count descendants with recursive CTE (for accurate comment_count update)
  const countResult = await db.firstOrNull<{ cnt: number }>(
    `WITH RECURSIVE tree AS (
       SELECT id FROM comments WHERE id = ?
       UNION ALL
       SELECT c.id FROM comments c JOIN tree t ON c.parent_id = t.id
     )
     SELECT COUNT(*) AS cnt FROM tree`,
    [commentId],
  );
  const deletedCount = countResult?.cnt ?? 1;

  // 3. DELETE — ON DELETE CASCADE handles children
  await db.execute("DELETE FROM comments WHERE id = ?", [commentId]);

  // 4. Decrement post.comment_count
  await db.execute(
    "UPDATE posts SET comment_count = MAX(0, comment_count - ?) WHERE id = ?",
    [deletedCount, comment.post_id],
  );

  return true;
}
