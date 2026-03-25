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
import { generateExcerpt } from "@/services/ai";
import { summarizeUnfurl } from "@/services/ai";
import { unfurlUrl, UnfurlError } from "@/services/unfurl";

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
    reference_url?: string | null;
    reference_title?: string | null;
    reference_description?: string | null;
    reference_image?: string | null;
  },
) {
  const existing = await getPostBySlug(ctx.db, args.slug);
  if (!existing) {
    return {
      content: [{ type: "text" as const, text: `Post not found: ${args.slug}` }],
      isError: true,
    };
  }

  // Tags and post fields are two separate DB operations. To approximate
  // atomicity we use compensating writes: save the old tag set before
  // touching anything, update tags, then update fields. If the field
  // update fails we restore the original tags so neither change sticks.
  let oldTagIds: string[] | undefined;

  if (args.tag_ids !== undefined) {
    const oldTags = await getPostTags(ctx.db, existing.id);
    oldTagIds = oldTags.map((t) => t.id);
    await setPostTags(ctx.db, existing.id, args.tag_ids);
  }

  try {
    const updated = await updatePost(ctx.db, existing.id, {
      title: args.title,
      slug: args.new_slug,
      content: args.content,
      status: args.status as PostStatus | undefined,
      excerpt: args.excerpt,
      category_id: args.category_id,
      featured_image: args.featured_image,
      published_at: args.published_at,
      reference_url: args.reference_url,
      reference_title: args.reference_title,
      reference_description: args.reference_description,
      reference_image: args.reference_image,
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }],
    };
  } catch (err) {
    // Compensate: restore original tags so we don't leave a partial update
    if (oldTagIds !== undefined) {
      await setPostTags(ctx.db, existing.id, oldTagIds).catch(() => {});
    }
    throw err;
  }
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

// ---------------------------------------------------------------------------
// generate_excerpt
// ---------------------------------------------------------------------------

export async function handleGenerateExcerpt(
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

  try {
    const excerpt = await generateExcerpt(post.title, post.content);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ slug: post.slug, excerpt }, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "AI not configured") {
      return {
        content: [{ type: "text" as const, text: "AI provider not configured. Go to Settings > AI to set it up." }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text" as const, text: `Excerpt generation failed: ${message}` }],
      isError: true,
    };
  }
}

// ---------------------------------------------------------------------------
// unfurl_reference
// ---------------------------------------------------------------------------

export async function handleUnfurlReference(
  ctx: ToolContext,
  args: {
    url?: string;
    slug?: string;
  },
) {
  // Determine the URL to unfurl
  let url = args.url;

  if (args.slug) {
    const post = await getPostBySlug(ctx.db, args.slug);
    if (!post) {
      return {
        content: [{ type: "text" as const, text: `Post not found: ${args.slug}` }],
        isError: true,
      };
    }

    if (!url) {
      url = post.reference_url ?? undefined;
    }

    if (!url) {
      return {
        content: [{ type: "text" as const, text: "No reference URL on post and no url provided." }],
        isError: true,
      };
    }

    // Unfurl and save to post
    try {
      const raw = await unfurlUrl(url);
      const ai = await summarizeUnfurl(raw.ogTitle, raw.ogDescription, raw.bodyText);

      const title = ai?.title ?? raw.ogTitle ?? raw.pageTitle ?? new URL(url).hostname;
      const description = ai?.description ?? raw.ogDescription ?? "";
      const image = raw.ogImage ?? raw.readmeImage ?? null;

      await updatePost(ctx.db, post.id, {
        reference_url: url,
        reference_title: title,
        reference_description: description,
        reference_image: image,
      });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            slug: args.slug,
            url,
            title,
            description,
            image,
            ai_enhanced: ai !== null,
            saved: true,
          }, null, 2),
        }],
      };
    } catch (err) {
      if (err instanceof UnfurlError) {
        return {
          content: [{ type: "text" as const, text: err.message }],
          isError: true,
        };
      }
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Unfurl failed: ${message}` }],
        isError: true,
      };
    }
  }

  // No slug — unfurl only (preview mode)
  if (!url) {
    return {
      content: [{ type: "text" as const, text: "Either url or slug is required." }],
      isError: true,
    };
  }

  try {
    const raw = await unfurlUrl(url);
    const ai = await summarizeUnfurl(raw.ogTitle, raw.ogDescription, raw.bodyText);

    const title = ai?.title ?? raw.ogTitle ?? raw.pageTitle ?? new URL(url).hostname;
    const description = ai?.description ?? raw.ogDescription ?? "";
    const image = raw.ogImage ?? raw.readmeImage ?? null;

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          url,
          title,
          description,
          image,
          ai_enhanced: ai !== null,
        }, null, 2),
      }],
    };
  } catch (err) {
    if (err instanceof UnfurlError) {
      return {
        content: [{ type: "text" as const, text: err.message }],
        isError: true,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `Unfurl failed: ${message}` }],
      isError: true,
    };
  }
}
