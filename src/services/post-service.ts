// ---------------------------------------------------------------------------
// PostService — best-effort orchestration for post writes (D1)
// Combines pure data primitives with cross-entity side effects.
// Primary write failure → throw; secondary effect failure → log, return success (D6).
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { PostWithCategory, PostWithTags, PostStatus } from "@/models/types";
import {
  createPost,
  updatePost,
  deletePost,
  getPostById,
  getPostBySlug,
  getPostTags,
  setPostTags,
  batchUpdatePosts,
  refreshCategoryPostCount,
  refreshAllCategoryPostCounts,
  refreshAllTagPostCounts,
  invalidatePostCaches,
} from "@/data/entities/post";
import type {
  CreatePostInput,
  UpdatePostInput,
  BatchUpdateInput,
} from "@/data/entities/post";
import { invalidateCategoryCache } from "@/data/entities/category";
import { invalidateTagCache } from "@/data/entities/tag";

// ---------------------------------------------------------------------------
// Service input types (extend entity input with orchestration fields)
// ---------------------------------------------------------------------------

export interface CreatePostServiceInput extends CreatePostInput {
  tagIds?: string[];
}

export interface UpdatePostServiceInput extends UpdatePostInput {
  tagIds?: string[];
}

// ---------------------------------------------------------------------------
// Best-effort helper — catches & logs secondary effect errors (D6)
// ---------------------------------------------------------------------------

async function bestEffort(
  label: string,
  fn: () => Promise<unknown>,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[PostService] ${label} failed (best-effort):`, err);
  }
}

// ---------------------------------------------------------------------------
// PostService
// ---------------------------------------------------------------------------

export const PostService = {
  // -------------------------------------------------------------------------
  // create — primary: createPost; secondary: tags, counts, caches
  // -------------------------------------------------------------------------

  async create(
    db: Db,
    input: CreatePostServiceInput,
  ): Promise<PostWithCategory> {
    const { tagIds, ...postInput } = input;

    // Primary write — throws on failure
    const post = await createPost(db, postInput);

    // Secondary effects — best-effort
    if (tagIds && tagIds.length > 0) {
      await bestEffort("setPostTags", () => setPostTags(db, post.id, tagIds));
    }

    if (post.category_id) {
      await bestEffort("refreshCategoryPostCount", () =>
        refreshCategoryPostCount(db, post.category_id),
      );
    }

    await bestEffort("refreshAllTagPostCounts", () =>
      refreshAllTagPostCounts(db),
    );

    invalidateCategoryCache();
    invalidateTagCache();

    return post;
  },

  // -------------------------------------------------------------------------
  // update — primary: updatePost; secondary: tags, counts, caches
  // -------------------------------------------------------------------------

  async update(
    db: Db,
    id: string,
    input: UpdatePostServiceInput,
  ): Promise<PostWithCategory | null> {
    const { tagIds, ...postInput } = input;

    // Fetch existing for comparison
    const existing = await getPostById(db, id);
    if (!existing) return null;

    // Primary write
    const updated = await updatePost(db, id, postInput);

    // Tags
    if (tagIds) {
      await bestEffort("setPostTags", () => setPostTags(db, id, tagIds));
      await bestEffort("refreshAllTagPostCounts", () =>
        refreshAllTagPostCounts(db),
      );
      invalidateTagCache();
    }

    // Category change → refresh old + new
    const categoryChanged =
      input.categoryId !== undefined &&
      input.categoryId !== existing.category_id;

    if (categoryChanged) {
      await bestEffort("refreshOldCategory", () =>
        refreshCategoryPostCount(db, existing.category_id),
      );
      await bestEffort("refreshNewCategory", () =>
        refreshCategoryPostCount(db, input.categoryId ?? null),
      );
      invalidateCategoryCache();
    }

    // Status change → refresh tag counts + archives
    const statusChanged =
      input.status !== undefined && input.status !== existing.status;

    if (statusChanged) {
      if (!tagIds) {
        // Only refresh if not already done above
        await bestEffort("refreshAllTagPostCounts", () =>
          refreshAllTagPostCounts(db),
        );
        invalidateTagCache();
      }
      // Category counts change when status changes (published counts)
      if (!categoryChanged) {
        await bestEffort("refreshCategoryPostCount", () =>
          refreshCategoryPostCount(db, existing.category_id),
        );
        invalidateCategoryCache();
      }
    }

    return updated;
  },

  // -------------------------------------------------------------------------
  // delete — primary: deletePost; secondary: counts, caches
  // -------------------------------------------------------------------------

  async delete(db: Db, id: string): Promise<boolean> {
    // Fetch before deletion for side effects
    const existing = await getPostById(db, id);

    const deleted = await deletePost(db, id);
    if (!deleted) return false;

    // Refresh counts
    if (existing?.category_id) {
      await bestEffort("refreshCategoryPostCount", () =>
        refreshCategoryPostCount(db, existing.category_id),
      );
    }

    await bestEffort("refreshAllTagPostCounts", () =>
      refreshAllTagPostCounts(db),
    );

    invalidateCategoryCache();
    invalidateTagCache();
    invalidatePostCaches();

    return true;
  },

  // -------------------------------------------------------------------------
  // batchUpdate — primary: batchUpdatePosts; secondary: broad refresh
  // -------------------------------------------------------------------------

  async batchUpdate(
    db: Db,
    ids: string[],
    input: BatchUpdateInput,
  ): Promise<number> {
    const count = await batchUpdatePosts(db, ids, input);

    // Broad refresh since multiple posts may span categories/tags
    await bestEffort("refreshAllCategoryPostCounts", () =>
      refreshAllCategoryPostCounts(db),
    );
    await bestEffort("refreshAllTagPostCounts", () =>
      refreshAllTagPostCounts(db),
    );

    invalidateCategoryCache();
    invalidateTagCache();
    invalidatePostCaches();

    return count;
  },

  // -------------------------------------------------------------------------
  // getWithTags — read: getById + getPostTags → PostWithTags
  // -------------------------------------------------------------------------

  async getWithTags(
    db: Db,
    id: string,
  ): Promise<PostWithTags | null> {
    const post = await getPostById(db, id);
    if (!post) return null;

    const tags = await getPostTags(db, id);
    return { ...post, tags };
  },

  // -------------------------------------------------------------------------
  // getBySlugWithTags — read: getBySlug + getPostTags → PostWithTags
  // -------------------------------------------------------------------------

  async getBySlugWithTags(
    db: Db,
    slug: string,
    status?: PostStatus,
  ): Promise<PostWithTags | null> {
    const post = await getPostBySlug(db, slug, status);
    if (!post) return null;

    const tags = await getPostTags(db, post.id);
    return { ...post, tags };
  },
};
