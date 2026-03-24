// ---------------------------------------------------------------------------
// MCP Post tools — CRUD + AI excerpt for blog posts
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { PostStatus } from "@/models/types";
import {
  listPosts,
  getPostBySlug,
  createPost,
  updatePost,
  deletePost,
  getPostTags,
  setPostTags,
} from "@/data/posts";

// ---------------------------------------------------------------------------
// Tool handler types
// ---------------------------------------------------------------------------

export interface ToolContext {
  db: Db;
}

// ---------------------------------------------------------------------------
// list_posts
// ---------------------------------------------------------------------------

export async function handleListPosts(
  ctx: ToolContext,
  args: {
    status?: string;
    category_id?: string;
    tag_id?: string;
    query?: string;
    page?: number;
    page_size?: number;
  },
) {
  const { posts, total } = await listPosts(ctx.db, {
    status: args.status as PostStatus | undefined,
    categoryId: args.category_id,
    tagId: args.tag_id,
    query: args.query,
    page: args.page ?? 1,
    pageSize: args.page_size ?? 20,
  });

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ posts, total }, null, 2),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// get_post
// ---------------------------------------------------------------------------

export async function handleGetPost(
  ctx: ToolContext,
  args: { slug: string },
) {
  const post = await getPostBySlug(ctx.db, args.slug);
  if (!post) {
    return {
      content: [{ type: "text" as const, text: `Post not found: ${args.slug}` }],
      isError: true,
    };
  }

  const tags = await getPostTags(ctx.db, post.id);

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ ...post, tags }, null, 2),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// create_post
// ---------------------------------------------------------------------------

export async function handleCreatePost(
  ctx: ToolContext,
  args: {
    title: string;
    slug: string;
    content: string;
    status?: string;
    excerpt?: string;
    category_id?: string;
    tag_ids?: string[];
    featured_image?: string;
    published_at?: number;
  },
) {
  const post = await createPost(ctx.db, {
    title: args.title,
    slug: args.slug,
    content: args.content,
    status: (args.status as PostStatus) ?? "draft",
    excerpt: args.excerpt,
    category_id: args.category_id,
    featured_image: args.featured_image,
    published_at: args.published_at,
  });

  if (args.tag_ids && args.tag_ids.length > 0) {
    try {
      await setPostTags(ctx.db, post.id, args.tag_ids);
    } catch (err) {
      // Rollback: delete the orphaned post so we don't leave half-committed data
      await deletePost(ctx.db, post.id).catch(() => {});
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Post created but tag assignment failed (rolled back): ${message}` }],
        isError: true,
      };
    }
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify(post, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// update_post
// ---------------------------------------------------------------------------

export async function handleUpdatePost(
  ctx: ToolContext,
  args: {
    slug: string;
    title?: string;
    new_slug?: string;
    content?: string;
    status?: string;
    excerpt?: string | null;
    category_id?: string | null;
    tag_ids?: string[];
    featured_image?: string | null;
    published_at?: number | null;
  },
) {
  const existing = await getPostBySlug(ctx.db, args.slug);
  if (!existing) {
    return {
      content: [{ type: "text" as const, text: `Post not found: ${args.slug}` }],
      isError: true,
    };
  }

  const updated = await updatePost(ctx.db, existing.id, {
    title: args.title,
    slug: args.new_slug,
    content: args.content,
    status: args.status as PostStatus | undefined,
    excerpt: args.excerpt,
    category_id: args.category_id,
    featured_image: args.featured_image,
    published_at: args.published_at,
  });

  if (args.tag_ids !== undefined) {
    try {
      await setPostTags(ctx.db, existing.id, args.tag_ids);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Post updated but tag assignment failed: ${message}. Post fields were saved; tags unchanged.` }],
        isError: true,
      };
    }
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// delete_post
// ---------------------------------------------------------------------------

export async function handleDeletePost(
  ctx: ToolContext,
  args: { slug: string },
) {
  const existing = await getPostBySlug(ctx.db, args.slug);
  if (!existing) {
    return {
      content: [{ type: "text" as const, text: `Post not found: ${args.slug}` }],
      isError: true,
    };
  }

  await deletePost(ctx.db, existing.id);

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ deleted: true }) }],
  };
}
