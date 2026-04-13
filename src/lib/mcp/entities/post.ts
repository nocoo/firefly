// ---------------------------------------------------------------------------
// Post Entity Definition — hooks, projection, extra tools
// ---------------------------------------------------------------------------

import { z } from "zod";
import type { Post, PostStatus } from "@/models/types";
import {
  listPosts,
  getPostById,
  getPostBySlug,
  updatePost,
  getPostTags,
} from "@/data/entities/post";
import { PostService } from "@/services/post-service";
import { generateExcerpt, summarizeUnfurl } from "@/services/ai";
import { unfurlUrl, UnfurlError } from "@/services/unfurl";
import type { EntityConfig, ToolContext } from "../framework/types";
import { resolveEntity } from "../framework/resolve";
import { ok, error } from "../framework/response";

// ---------------------------------------------------------------------------
// Extra tool: unfurl_reference (two modes: preview + save)
// ---------------------------------------------------------------------------

async function handleUnfurlReference(
  ctx: ToolContext,
  args: Record<string, unknown>,
) {
  const id = args.id as string | undefined;
  const slug = args.slug as string | undefined;
  let url = args.url as string | undefined;

  // If id or slug provided → save mode
  if (id || slug) {
    const idOrSlug: Record<string, string> = {};
    if (id) idOrSlug.id = id;
    if (slug) idOrSlug.slug = slug;
    const resolved = await resolveEntity(
      ctx.db,
      idOrSlug,
      getPostById,
      getPostBySlug,
      "Post",
    );
    if ("error" in resolved) return error(resolved.error);

    if (!url) {
      url = resolved.reference_url ?? undefined;
    }

    if (!url) {
      return error("No reference URL on post and no url provided.");
    }

    try {
      const raw = await unfurlUrl(url);
      const ai = await summarizeUnfurl(
        raw.ogTitle,
        raw.ogDescription,
        raw.bodyText,
      );

      const title =
        ai?.title ?? raw.ogTitle ?? raw.pageTitle ?? new URL(url).hostname;
      const description = ai?.description ?? raw.ogDescription ?? "";
      const image = raw.ogImage ?? raw.readmeImage ?? null;

      await updatePost(ctx.db, resolved.id, {
        referenceUrl: url,
        referenceTitle: title,
        referenceDescription: description,
        referenceImage: image,
      });

      return ok({
        slug: resolved.slug,
        url,
        title,
        description,
        image,
        ai_enhanced: ai !== null,
        saved: true,
      });
    } catch (err) {
      if (err instanceof UnfurlError) return error(err.message);
      const msg = err instanceof Error ? err.message : String(err);
      return error(`Unfurl failed: ${msg}`);
    }
  }

  // No id/slug → preview mode (url only)
  if (!url) {
    return error("Either url or slug is required.");
  }

  try {
    const raw = await unfurlUrl(url);
    const ai = await summarizeUnfurl(
      raw.ogTitle,
      raw.ogDescription,
      raw.bodyText,
    );

    const title =
      ai?.title ?? raw.ogTitle ?? raw.pageTitle ?? new URL(url).hostname;
    const description = ai?.description ?? raw.ogDescription ?? "";
    const image = raw.ogImage ?? raw.readmeImage ?? null;

    return ok({
      url,
      title,
      description,
      image,
      ai_enhanced: ai !== null,
    });
  } catch (err) {
    if (err instanceof UnfurlError) return error(err.message);
    const msg = err instanceof Error ? err.message : String(err);
    return error(`Unfurl failed: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Entity Config
// ---------------------------------------------------------------------------

export const postEntity: EntityConfig<Post> = {
  name: "post",
  display: "Post",
  dataLayer: {
    list: async (db, opts) => {
      const o = (opts ?? {}) as Record<string, unknown>;
      const result = await listPosts(db, {
        status: o.status as PostStatus | undefined,
        categoryId: o.category_id as string | undefined,
        tagId: o.tag_id as string | undefined,
        query: o.query as string | undefined,
        page: (o.page as number) ?? 1,
        pageSize: (o.page_size as number) ?? 20,
      });
      return { items: result.posts, total: result.total };
    },
    getById: (db, id) => getPostById(db, id),
    getBySlug: (db, slug) => getPostBySlug(db, slug),
    create: (db, input) => PostService.create(db, input),
    update: (db, id, input) => PostService.update(db, id, input),
    delete: (db, id) => PostService.delete(db, id),
  },
  schemas: {
    list: {
      status: z
        .enum(["draft", "published", "private", "archived"])
        .optional(),
      category_id: z.string().optional(),
      tag_id: z.string().optional(),
      query: z.string().optional(),
      page: z.number().optional(),
      page_size: z.number().min(1).max(100).optional(),
    },
    create: {
      title: z.string(),
      slug: z.string(),
      content: z.string(),
      status: z
        .enum(["draft", "published", "private", "archived"])
        .optional(),
      excerpt: z.string().optional(),
      category_id: z.string().optional(),
      tag_ids: z.array(z.string()).optional(),
      featured_image: z.string().optional(),
      published_at: z.number().optional(),
    },
    update: {
      title: z.string().optional(),
      new_slug: z.string().optional(),
      content: z.string().optional(),
      status: z
        .enum(["draft", "published", "private", "archived"])
        .optional(),
      excerpt: z.string().nullable().optional(),
      category_id: z.string().nullable().optional(),
      tag_ids: z.array(z.string()).optional(),
      featured_image: z.string().nullable().optional(),
      published_at: z.number().nullable().optional(),
      reference_url: z.string().nullable().optional(),
      reference_title: z.string().nullable().optional(),
      reference_description: z.string().nullable().optional(),
      reference_image: z.string().nullable().optional(),
    },
  },
  hooks: {
    afterGet: async (ctx, post) => ({
      ...post,
      tags: await getPostTags(ctx.db, post.id),
    }),
    mapCreateInput: (args) => {
      const { tag_ids, category_id, featured_image, published_at, ...rest } = args;
      return {
        ...rest,
        ...(tag_ids !== undefined && { tagIds: tag_ids }),
        ...(category_id !== undefined && { categoryId: category_id }),
        ...(featured_image !== undefined && { featuredImage: featured_image }),
        ...(published_at !== undefined && { publishedAt: published_at }),
      };
    },
    mapUpdateInput: (args) => {
      const {
        tag_ids,
        new_slug,
        category_id,
        featured_image,
        published_at,
        reference_url,
        reference_title,
        reference_description,
        reference_image,
        ...rest
      } = args;
      return {
        ...rest,
        ...(tag_ids !== undefined && { tagIds: tag_ids }),
        ...(new_slug !== undefined && { slug: new_slug }),
        ...(category_id !== undefined && { categoryId: category_id }),
        ...(featured_image !== undefined && { featuredImage: featured_image }),
        ...(published_at !== undefined && { publishedAt: published_at }),
        ...(reference_url !== undefined && { referenceUrl: reference_url }),
        ...(reference_title !== undefined && { referenceTitle: reference_title }),
        ...(reference_description !== undefined && { referenceDescription: reference_description }),
        ...(reference_image !== undefined && { referenceImage: reference_image }),
      };
    },
  },
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
  extraTools: [
    {
      name: "generate_excerpt",
      description:
        "Generate an AI-powered excerpt for a post by id or slug (exactly one required).",
      schema: {
        id: z.string().optional(),
        slug: z.string().optional(),
      },
      handler: async (ctx, args) => {
        const resolved = await resolveEntity(
          ctx.db,
          args,
          getPostById,
          getPostBySlug,
          "Post",
        );
        if ("error" in resolved) return error(resolved.error);
        try {
          const excerpt = await generateExcerpt(
            resolved.title,
            resolved.content,
          );
          await updatePost(ctx.db, resolved.id, { excerpt });
          return ok({ slug: resolved.slug, excerpt, saved: true });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg === "AI not configured") {
            return error(
              "AI provider not configured. Go to Settings > AI to set it up.",
            );
          }
          return error(`Excerpt generation failed: ${msg}`);
        }
      },
    },
    {
      name: "unfurl_reference",
      description:
        "Unfurl a URL to extract metadata. Pass url alone to preview, or id/slug (with optional url) to unfurl and save to a post.",
      schema: {
        id: z.string().optional(),
        slug: z.string().optional(),
        url: z.string().optional(),
      },
      handler: handleUnfurlReference,
    },
  ],
  descriptions: {
    list: "List posts with filtering and pagination. Returns posts without content by default (use include: ['content'] for full text).",
    get: "Get a single post with full content and tags by id or slug (exactly one required).",
    create: "Create a new blog post. Set tag_ids to associate tags.",
    update:
      "Update an existing post by id or slug (exactly one required). Set tag_ids to replace all tags.",
    delete:
      "Delete a post by id or slug (exactly one required). Irreversible.",
  },
};
