// ---------------------------------------------------------------------------
// Agent Post Entity — constrained post entity for AI agents
//
// Each agent can only access posts they created (via ai_agent_id).
// - create forces status = "private", categoryId = agent's category, aiAgentId = agent.id
// - update ignores status field
// - No extra tools (generate_excerpt, unfurl_reference disabled)
// ---------------------------------------------------------------------------

import { z } from "zod";
import type { Post, AiAgent } from "@/models/types";
import type { EntityConfig } from "../framework/types";
import {
  listPosts,
  getPostById,
  getPostBySlug,
  getPostTags,
} from "@/data/entities/post";
import { PostService } from "@/services/post-service";

/**
 * Create a constrained post entity for a specific agent.
 *
 * - list/get/create/update/delete all scoped to agent's ai_agent_id
 * - create forces status = "private", injects aiAgentId
 * - update ignores status field
 * - Reuses projection and afterGet from postEntity for consistent behavior
 * - NO extra tools (generate_excerpt, unfurl_reference disabled)
 */
export function createAgentPostEntity(agent: AiAgent): EntityConfig<Post> {
  const categoryId = agent.category_id;
  const agentId = agent.id;

  return {
    name: "post",
    display: "Post",
    dataLayer: {
      // list: force ai_agent_id filter (agent can only see own posts)
      list: async (db, opts) => {
        const o = (opts ?? {}) as Record<string, unknown>;
        // Reject if client tries to specify different ai_agent_id
        if (o.ai_agent_id && o.ai_agent_id !== agentId) {
          throw new Error("Access denied: You can only access your own posts");
        }
        const result = await listPosts(db, {
          aiAgentId: agentId, // forced
          status: o.status as "draft" | "published" | "private" | "archived" | undefined,
          query: o.query as string | undefined,
          page: (o.page as number) ?? 1,
          pageSize: (o.page_size as number) ?? 20,
        });
        return { items: result.posts, total: result.total };
      },

      // getById: verify ai_agent_id ownership
      getById: async (db, id) => {
        const post = await getPostById(db, id);
        if (post && post.ai_agent_id !== agentId) {
          return null; // treat as not found
        }
        return post;
      },

      // getBySlug: verify ai_agent_id ownership
      getBySlug: async (db, slug) => {
        const post = await getPostBySlug(db, slug);
        if (post && post.ai_agent_id !== agentId) {
          return null;
        }
        return post;
      },

      // create: force category + status + aiAgentId
      create: async (db, input: Record<string, unknown>) => {
        return PostService.create(db, {
          ...input,
          categoryId,           // forced to agent's category
          status: "private",    // forced
          aiAgentId: agentId,   // mark as created by this agent
        } as Parameters<typeof PostService.create>[1]);
      },

      // update: strip status, block ai_agent_id change
      update: async (db, id, input: Record<string, unknown>) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { status, categoryId: inputCategoryId, aiAgentId: inputAgentId, ...rest } = input;
        if (inputAgentId && inputAgentId !== agentId) {
          throw new Error("Access denied: Cannot reassign post to different agent");
        }
        // status is silently ignored, categoryId change blocked
        if (inputCategoryId && inputCategoryId !== categoryId) {
          throw new Error("Access denied: Cannot move post to different category");
        }
        return PostService.update(db, id, rest as Parameters<typeof PostService.update>[2]);
      },

      // delete: ownership already verified by getById in framework
      delete: (db, id) => PostService.delete(db, id),
    },
    schemas: {
      list: {
        status: z.enum(["draft", "published", "private", "archived"]).optional(),
        query: z.string().optional(),
        page: z.number().optional(),
        page_size: z.number().min(1).max(100).optional(),
        // category_id intentionally omitted — agent can't change it
      },
      create: {
        title: z.string(),
        slug: z.string(),
        content: z.string(),
        // status intentionally omitted — forced to private
        excerpt: z.string().optional(),
        // category_id intentionally omitted — forced to agent's category
        tag_ids: z.array(z.string()).optional(),
        featured_image: z.string().optional(),
      },
      update: {
        title: z.string().optional(),
        new_slug: z.string().optional(),
        content: z.string().optional(),
        // status intentionally omitted — agent cannot change it
        excerpt: z.string().nullable().optional(),
        // category_id intentionally omitted
        tag_ids: z.array(z.string()).optional(),
        featured_image: z.string().nullable().optional(),
      },
    },
    // ─────────────────────────────────────────────────────────────
    // Reuse hooks from postEntity for consistent behavior
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
    // Reuse projection from postEntity for consistent list response
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
    // NO extraTools — generate_excerpt and unfurl_reference disabled for agents
    extraTools: [],
    descriptions: {
      list: `List posts in your assigned category (${agent.name}).`,
      get: "Get a single post by id or slug (returns with tags).",
      create: "Create a new post (status will be set to private).",
      update: "Update an existing post (cannot change status).",
      delete: "Delete a post.",
    },
  };
}
