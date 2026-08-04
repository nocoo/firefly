// ---------------------------------------------------------------------------
// Comment entity — read + create + delete
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
// createComment — insert a new top-level or nested comment
// ---------------------------------------------------------------------------

export interface CreateCommentInput {
  postId: string;
  authorName: string;
  content: string;
  parentId?: string | null;
  authorEmail?: string | null;
  authorUrl?: string | null;
}

export async function createComment(
  db: Db,
  input: CreateCommentInput,
): Promise<Comment> {
  const id = crypto.randomUUID();
  const createdAt = Math.floor(Date.now() / 1000);
  const parentId = input.parentId ?? null;
  const authorEmail = input.authorEmail ?? null;
  const authorUrl = input.authorUrl ?? null;

  await db.execute(
    `INSERT INTO comments (
       id, post_id, parent_id, author_name, author_email, author_url,
       content, wp_id, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [id, input.postId, parentId, input.authorName, authorEmail, authorUrl, input.content, createdAt],
  );
  await db.execute(
    "UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?",
    [input.postId],
  );

  return {
    id,
    post_id: input.postId,
    parent_id: parentId,
    author_name: input.authorName,
    author_email: authorEmail,
    author_url: authorUrl,
    content: input.content,
    wp_id: null,
    created_at: createdAt,
  };
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

  // 2. Count descendants by walking the parent_id → children map in JS.
  //    Previously used `WITH RECURSIVE tree AS …` but the Worker's
  //    `/api/v1/query` gate is fail-closed against WITH (STU-2497: any
  //    CTE opens up scrub bypass paths, no other prod caller needed
  //    one). A single-post comment set is small — the extra rows are
  //    cheap versus the security posture of the gate.
  const rows = await db.query<{ id: string; parent_id: string | null }>(
    "SELECT id, parent_id FROM comments WHERE post_id = ?",
    [comment.post_id],
  );
  const childrenByParent = new Map<string, string[]>();
  for (const r of rows.results) {
    if (!r.parent_id) continue;
    const bucket = childrenByParent.get(r.parent_id);
    if (bucket) bucket.push(r.id);
    else childrenByParent.set(r.parent_id, [r.id]);
  }
  // BFS from the target commentId, counting itself + all descendants.
  let deletedCount = 0;
  const stack = [commentId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    deletedCount++;
    const kids = childrenByParent.get(id);
    if (kids) stack.push(...kids);
  }
  if (deletedCount === 0) deletedCount = 1;

  // 3. DELETE — ON DELETE CASCADE handles children
  await db.execute("DELETE FROM comments WHERE id = ?", [commentId]);

  // 4. Decrement post.comment_count
  await db.execute(
    "UPDATE posts SET comment_count = MAX(0, comment_count - ?) WHERE id = ?",
    [deletedCount, comment.post_id],
  );

  return true;
}
