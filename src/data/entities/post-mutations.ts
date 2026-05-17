// ---------------------------------------------------------------------------
// Post entity — write mutations (create/update/delete/batch)
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { PostWithAgent } from "@/models/types";
import { readingTime, excerptFromContent } from "@/models/post";
import { renderMarkdown } from "@/models/markdown";
import { nowEpoch, newId } from "@/data/core/timestamps";
import type {
  CreatePostInput,
  UpdatePostInput,
  BatchUpdateInput,
} from "./post-types";
import { getPostById } from "./post-queries";

export async function createPost(
  db: Db,
  input: CreatePostInput,
): Promise<PostWithAgent> {
  const id = newId();
  const now = nowEpoch();

  const computedReadingTime = readingTime(input.content);
  const computedExcerpt = input.excerpt ?? excerptFromContent(input.content);
  const contentHtml = renderMarkdown(input.content);

  const publishedAt =
    input.publishedAt ?? (input.status === "published" ? now : null);

  const sql = `
    INSERT INTO posts (
      id, title, slug, content, content_html, excerpt, status,
      category_id, ai_agent_id, featured_image, comment_enabled,
      reading_time, published_at,
      reference_url, reference_title, reference_description, reference_image,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await db.execute(sql, [
    id,
    input.title,
    input.slug,
    input.content,
    contentHtml,
    computedExcerpt,
    input.status,
    input.categoryId ?? null,
    input.aiAgentId ?? null,
    input.featuredImage ?? null,
    input.commentEnabled ?? 0,
    computedReadingTime,
    publishedAt,
    input.referenceUrl ?? null,
    input.referenceTitle ?? null,
    input.referenceDescription ?? null,
    input.referenceImage ?? null,
    now,
    now,
  ]);

  const post = await getPostById(db, id);
  if (!post) throw new Error(`Failed to retrieve Post ${id} after creation`);
  return post;
}

// ---- updatePost helpers -----------------------------------------------------

interface SetBuilder {
  clauses: string[];
  params: unknown[];
}

function addSet(b: SetBuilder, column: string, value: unknown): void {
  b.clauses.push(`${column} = ?`);
  b.params.push(value);
}

/** Update content + derived columns (reading_time, content_html, excerpt). */
function applyContentUpdate(b: SetBuilder, input: UpdatePostInput): void {
  if (input.content === undefined) return;
  addSet(b, "content", input.content);
  addSet(b, "reading_time", readingTime(input.content));
  addSet(b, "content_html", renderMarkdown(input.content));
  if (input.excerpt === undefined) {
    addSet(b, "excerpt", excerptFromContent(input.content));
  }
}

/** Update excerpt explicitly; null = regenerate from content (input or existing). */
function applyExcerptUpdate(
  b: SetBuilder,
  input: UpdatePostInput,
  existing: PostWithAgent,
): void {
  if (input.excerpt === undefined) return;
  if (input.excerpt === null) {
    const contentForExcerpt = input.content ?? existing.content;
    addSet(b, "excerpt", excerptFromContent(contentForExcerpt));
  } else {
    addSet(b, "excerpt", input.excerpt);
  }
}

/** Apply reference_* fields, clearing orphan metadata when referenceUrl is null. */
function applyReferenceUpdate(b: SetBuilder, input: UpdatePostInput): void {
  if (input.referenceUrl !== undefined) {
    addSet(b, "reference_url", input.referenceUrl);
  }
  // Defense-in-depth: clear orphan reference metadata when referenceUrl is null
  if (input.referenceUrl === null) {
    if (input.referenceTitle === undefined) addSet(b, "reference_title", null);
    if (input.referenceDescription === undefined)
      addSet(b, "reference_description", null);
    if (input.referenceImage === undefined) addSet(b, "reference_image", null);
  }
  if (input.referenceTitle !== undefined) {
    addSet(b, "reference_title", input.referenceTitle);
  }
  if (input.referenceDescription !== undefined) {
    addSet(b, "reference_description", input.referenceDescription);
  }
  if (input.referenceImage !== undefined) {
    addSet(b, "reference_image", input.referenceImage);
  }
}

/** Set published_at correctly. Auto-fills now() for published posts with null timestamp. */
function applyPublishedAt(
  b: SetBuilder,
  input: UpdatePostInput,
  existing: PostWithAgent,
): void {
  const finalPublishedAt =
    input.publishedAt !== undefined ? input.publishedAt : existing.published_at;
  const finalStatus = input.status ?? existing.status;
  const needsAuto = finalStatus === "published" && finalPublishedAt == null;

  if (needsAuto) {
    addSet(b, "published_at", nowEpoch());
  } else if (input.publishedAt !== undefined) {
    addSet(b, "published_at", input.publishedAt);
  }
}

/** Apply all simple scalar fields (title/slug/status/etc.). */
function applySimpleFields(b: SetBuilder, input: UpdatePostInput): void {
  if (input.title !== undefined) addSet(b, "title", input.title);
  if (input.slug !== undefined) addSet(b, "slug", input.slug);
  if (input.status !== undefined) addSet(b, "status", input.status);
  if (input.categoryId !== undefined) addSet(b, "category_id", input.categoryId);
  if (input.featuredImage !== undefined)
    addSet(b, "featured_image", input.featuredImage);
  if (input.commentEnabled !== undefined)
    addSet(b, "comment_enabled", input.commentEnabled);
  if (input.aiAgentId !== undefined) addSet(b, "ai_agent_id", input.aiAgentId);
}

export async function updatePost(
  db: Db,
  id: string,
  input: UpdatePostInput,
): Promise<PostWithAgent | null> {
  const existing = await getPostById(db, id);
  if (!existing) return null;

  const b: SetBuilder = { clauses: [], params: [] };

  applySimpleFields(b, input);
  applyContentUpdate(b, input);
  applyExcerptUpdate(b, input, existing);
  applyReferenceUpdate(b, input);
  applyPublishedAt(b, input, existing);

  if (b.clauses.length === 0) return getPostById(db, id);

  addSet(b, "updated_at", nowEpoch());

  const sql = `UPDATE posts SET ${b.clauses.join(", ")} WHERE id = ?`;
  await db.execute(sql, [...b.params, id]);

  return getPostById(db, id);
}

export async function deletePost(db: Db, id: string): Promise<boolean> {
  const meta = await db.execute("DELETE FROM posts WHERE id = ?", [id]);
  return meta.changes > 0;
}

export async function batchUpdatePosts(
  db: Db,
  ids: string[],
  input: BatchUpdateInput,
): Promise<number> {
  if (ids.length === 0) return 0;

  const setClauses: string[] = [];
  const params: unknown[] = [];

  if (input.status !== undefined) {
    setClauses.push("status = ?");
    params.push(input.status);
  }
  if (input.categoryId !== undefined) {
    setClauses.push("category_id = ?");
    params.push(input.categoryId);
  }

  if (setClauses.length === 0) return 0;

  setClauses.push("updated_at = ?");
  params.push(nowEpoch());

  if (input.status === "published") {
    setClauses.push("published_at = COALESCE(published_at, ?)");
    params.push(nowEpoch());
  }

  const placeholders = ids.map(() => "?").join(", ");
  params.push(...ids);

  const sql = `UPDATE posts SET ${setClauses.join(", ")} WHERE id IN (${placeholders})`;
  const result = await db.execute(sql, params);
  return result.changes;
}
