// ---------------------------------------------------------------------------
// Author Post Entity — constrained post entity for AI authors (author scope)
//
// Requires author_id in all operations to identify the AI author.
// - create forces status = "private", categoryId = author's category, aiAgentId = author_id
// - update ignores status field
// - No extra tools (generate_excerpt, unfurl_reference disabled)
// ---------------------------------------------------------------------------

import { z } from "zod";
import type { Post } from "@/models/types";
import type { Db } from "@/lib/db";
import type { EntityConfig } from "../framework/types";
import {
  listPosts,
  getPostById,
  getPostBySlug,
  getPostTags,
} from "@/data/entities/post";
import { getAiAgentById } from "@/data/entities/ai-agent";
import { PostService } from "@/services/post-service";

/**
 * Get and validate author from the database.
 * Throws if author_id is missing or author not found.
 */
async function requireAuthor(db: Db, authorId: unknown) {
  if (!authorId || typeof authorId !== "string") {
    throw new Error("author_id is required for all operations");
  }
  const author = await getAiAgentById(db, authorId);
  if (!author) {
    throw new Error(`Author not found: ${authorId}`);
  }
  return author;
}

/**
 * Create a constrained post entity for author scope.
 *
 * - All operations require author_id in arguments
 * - list/get/create/update/delete all scoped to the provided author_id
 * - create forces status = "private", injects aiAgentId and categoryId from author
 * - update ignores status field
 * - NO extra tools (generate_excerpt, unfurl_reference disabled)
 */
export function createAuthorPostEntity(): EntityConfig<Post> {
  return {
    name: "post",
    display: "Post",
    dataLayer: {
      // list: require author_id, filter by ai_agent_id
      list: async (db, opts) => {
        const o = (opts ?? {}) as Record<string, unknown>;
        const author = await requireAuthor(db, o.author_id);

        const result = await listPosts(db, {
          aiAgentId: author.id,
          status: o.status as "draft" | "published" | "private" | "archived" | undefined,
          query: o.query as string | undefined,
          page: (o.page as number) ?? 1,
          pageSize: (o.page_size as number) ?? 20,
        });
        return { items: result.posts, total: result.total };
      },

      // getById: require author_id, verify ownership
      getById: async (db, id, args) => {
        const o = (args ?? {}) as Record<string, unknown>;
        const author = await requireAuthor(db, o.author_id);

        const post = await getPostById(db, id);
        if (post && post.ai_agent_id !== author.id) {
          return null; // treat as not found
        }
        return post;
      },

      // getBySlug: require author_id, verify ownership
      getBySlug: async (db, slug, args) => {
        const o = (args ?? {}) as Record<string, unknown>;
        const author = await requireAuthor(db, o.author_id);

        const post = await getPostBySlug(db, slug);
        if (post && post.ai_agent_id !== author.id) {
          return null;
        }
        return post;
      },

      // create: require author_id, force category + status + aiAgentId
      create: async (db, input: Record<string, unknown>) => {
        const author = await requireAuthor(db, input.author_id);

        return PostService.create(db, {
          ...input,
          categoryId: author.category_id,   // forced to author's category
          status: "private",                 // forced
          aiAgentId: author.id,              // mark as created by this author
        } as Parameters<typeof PostService.create>[1]);
      },

      // update: require author_id, strip status, block ai_agent_id change
      update: async (db, id, input: Record<string, unknown>) => {
        const author = await requireAuthor(db, input.author_id);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { status, categoryId: inputCategoryId, aiAgentId: inputAgentId, author_id, ...rest } = input;

        if (inputAgentId && inputAgentId !== author.id) {
          throw new Error("Access denied: Cannot reassign post to different author");
        }
        if (inputCategoryId && inputCategoryId !== author.category_id) {
          throw new Error("Access denied: Cannot move post to different category");
        }

        // Verify ownership before update
        const existing = await getPostById(db, id);
        if (!existing || existing.ai_agent_id !== author.id) {
          throw new Error("Post not found or access denied");
        }

        return PostService.update(db, id, rest as Parameters<typeof PostService.update>[2]);
      },

      // delete: require author_id, verify ownership
      delete: async (db, id, args) => {
        const o = (args ?? {}) as Record<string, unknown>;
        const author = await requireAuthor(db, o.author_id);

        // Verify ownership before delete
        const existing = await getPostById(db, id);
        if (!existing || existing.ai_agent_id !== author.id) {
          throw new Error("Post not found or access denied");
        }

        return PostService.delete(db, id);
      },
    },
    schemas: {
      list: {
        author_id: z.string().describe("Your author ID (required)"),
        status: z.enum(["draft", "published", "private", "archived"]).optional(),
        query: z.string().optional(),
        page: z.number().optional(),
        page_size: z.number().min(1).max(100).optional(),
      },
      get: {
        author_id: z.string().describe("Your author ID (required)"),
      },
      create: {
        author_id: z.string().describe("Your author ID (required)"),
        title: z.string(),
        slug: z.string(),
        content: z.string(),
        // status intentionally omitted — forced to private
        excerpt: z.string().optional(),
        // category_id intentionally omitted — forced to author's category
        tag_ids: z.array(z.string()).optional(),
        featured_image: z.string().optional(),
      },
      update: {
        author_id: z.string().describe("Your author ID (required)"),
        title: z.string().optional(),
        new_slug: z.string().optional(),
        content: z.string().optional(),
        // status intentionally omitted — author cannot change it
        excerpt: z.string().nullable().optional(),
        // category_id intentionally omitted
        tag_ids: z.array(z.string()).optional(),
        featured_image: z.string().nullable().optional(),
      },
      delete: {
        author_id: z.string().describe("Your author ID (required)"),
      },
    },
    // ─────────────────────────────────────────────────────────────
    // Hooks for consistent behavior
    // ─────────────────────────────────────────────────────────────
    hooks: {
      // afterGet: enrich with tags (same as postEntity)
      afterGet: async (ctx, post) => ({
        ...post,
        tags: await getPostTags(ctx.db, post.id),
      }),
      // mapCreateInput: same field mapping as postEntity
      mapCreateInput: (args) => {
        const { tag_ids, featured_image, ...rest } = args as Record<string, unknown>;
        return {
          ...rest,
          ...(tag_ids !== undefined && { tagIds: tag_ids }),
          ...(featured_image !== undefined && { featuredImage: featured_image }),
        };
      },
      // mapUpdateInput: same field mapping as postEntity
      mapUpdateInput: (args) => {
        const { tag_ids, new_slug, featured_image, ...rest } = args as Record<string, unknown>;
        return {
          ...rest,
          ...(tag_ids !== undefined && { tagIds: tag_ids }),
          ...(new_slug !== undefined && { slug: new_slug }),
          ...(featured_image !== undefined && { featuredImage: featured_image }),
        };
      },
    },
    // ─────────────────────────────────────────────────────────────
    // Projection for consistent list response
    // ─────────────────────────────────────────────────────────────
    projection: {
      omit: [
        "content",
        "content_html",
        "wp_id",
        "wp_permalink",
        "comment_enabled",
        "reference_description",
        "reference_image",
      ],
      groups: {
        content: ["content"],
        content_html: ["content_html"],
        wp: ["wp_id", "wp_permalink"],
        comment_enabled: ["comment_enabled"],
        reference_detail: ["reference_description", "reference_image"],
      },
    },
    // NO extraTools — generate_excerpt and unfurl_reference disabled for authors
    extraTools: [],
    descriptions: {
      list: "List posts created by the specified author. Requires author_id.",
      get: "Get a single post by id or slug. Requires author_id to verify authorship.",
      create: "Create a new post as the specified author. Status is set to private, category is the author's assigned category. Requires author_id.",
      update: "Update a post. Requires author_id to verify authorship. Cannot change status.",
      delete: "Delete a post. Requires author_id to verify authorship.",
    },
  };
}
