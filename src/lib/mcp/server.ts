// ---------------------------------------------------------------------------
// MCP Server — tool registration and server instance factory
// ---------------------------------------------------------------------------
//
// Zod v4 ShapeOutput uses `T | undefined` for optional properties, which
// conflicts with TypeScript's exactOptionalPropertyTypes. We cast tool
// callbacks to `any` where needed — the Zod schema validates inputs at
// runtime, and the handler functions have their own typed parameters.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { APP_VERSION } from "@/lib/version";
import type { Db } from "@/lib/db";
import type { ToolContext } from "@/lib/mcp/tools/posts";
import {
  handleListPosts,
  handleGetPost,
  handleCreatePost,
  handleUpdatePost,
  handleDeletePost,
  handleGenerateExcerpt,
} from "@/lib/mcp/tools/posts";
import {
  handleListTags,
  handleGetTag,
  handleCreateTag,
  handleUpdateTag,
  handleDeleteTag,
} from "@/lib/mcp/tools/tags";
import {
  handleListCategories,
  handleGetCategory,
  handleCreateCategory,
  handleUpdateCategory,
  handleDeleteCategory,
} from "@/lib/mcp/tools/categories";

// ---------------------------------------------------------------------------
// createMcpServer
// ---------------------------------------------------------------------------

/** Create a new McpServer instance with all tools registered. */
export function createMcpServer(db: Db): McpServer {
  const server = new McpServer({
    name: "firefly",
    version: APP_VERSION,
  });

  const ctx: ToolContext = { db };

  // ----- Post tools -----

  server.tool(
    "list_posts",
    "List blog posts with optional filters. Returns all statuses for authenticated users.",
    {
      status: z.enum(["draft", "published", "private", "archived"]).optional(),
      category_id: z.string().optional(),
      tag_id: z.string().optional(),
      query: z.string().optional(),
      page: z.number().optional(),
      page_size: z.number().min(1).max(100).optional(),
    },
    (args: any) => handleListPosts(ctx, args),
  );

  server.tool(
    "get_post",
    "Get a single post by slug with tags and category.",
    { slug: z.string() },
    (args) => handleGetPost(ctx, args),
  );

  server.tool(
    "create_post",
    "Create a new blog post. Status defaults to draft.",
    {
      title: z.string(),
      slug: z.string(),
      content: z.string(),
      status: z.enum(["draft", "published", "private", "archived"]).optional(),
      excerpt: z.string().optional(),
      category_id: z.string().optional(),
      tag_ids: z.array(z.string()).optional(),
      featured_image: z.string().optional(),
      published_at: z.number().optional(),
    },
    (args: any) => handleCreatePost(ctx, args),
  );

  server.tool(
    "update_post",
    "Update an existing post by slug. Only provided fields are updated. Pass null for excerpt to clear and auto-regenerate.",
    {
      slug: z.string(),
      title: z.string().optional(),
      new_slug: z.string().optional(),
      content: z.string().optional(),
      status: z.enum(["draft", "published", "private", "archived"]).optional(),
      excerpt: z.string().nullable().optional(),
      category_id: z.string().nullable().optional(),
      tag_ids: z.array(z.string()).optional(),
      featured_image: z.string().nullable().optional(),
      published_at: z.number().nullable().optional(),
    },
    (args: any) => handleUpdatePost(ctx, args),
  );

  server.tool(
    "delete_post",
    "Permanently delete a post by slug. Irreversible.",
    { slug: z.string() },
    (args) => handleDeletePost(ctx, args),
  );

  server.tool(
    "generate_excerpt",
    "Generate an AI-powered excerpt for a post by slug. Requires AI provider to be configured.",
    { slug: z.string() },
    (args) => handleGenerateExcerpt(ctx, args),
  );

  // ----- Tag tools -----

  server.tool(
    "list_tags",
    "List all tags ordered by name.",
    {},
    () => handleListTags(ctx),
  );

  server.tool(
    "get_tag",
    "Get a single tag by slug.",
    { slug: z.string() },
    (args) => handleGetTag(ctx, args),
  );

  server.tool(
    "create_tag",
    "Create a new tag. Name and slug are required.",
    { name: z.string(), slug: z.string() },
    (args) => handleCreateTag(ctx, args),
  );

  server.tool(
    "update_tag",
    "Update an existing tag by slug.",
    {
      slug: z.string(),
      name: z.string().optional(),
      new_slug: z.string().optional(),
    },
    (args: any) => handleUpdateTag(ctx, args),
  );

  server.tool(
    "delete_tag",
    "Delete a tag by slug.",
    { slug: z.string() },
    (args) => handleDeleteTag(ctx, args),
  );

  // ----- Category tools -----

  server.tool(
    "list_categories",
    "List all categories ordered by sort_order then name.",
    {},
    () => handleListCategories(ctx),
  );

  server.tool(
    "get_category",
    "Get a single category by slug.",
    { slug: z.string() },
    (args) => handleGetCategory(ctx, args),
  );

  server.tool(
    "create_category",
    "Create a new category. Name and slug are required.",
    {
      name: z.string(),
      slug: z.string(),
      description: z.string().optional(),
      sort_order: z.number().optional(),
    },
    (args: any) => handleCreateCategory(ctx, args),
  );

  server.tool(
    "update_category",
    "Update an existing category by slug.",
    {
      slug: z.string(),
      name: z.string().optional(),
      new_slug: z.string().optional(),
      description: z.string().nullable().optional(),
      sort_order: z.number().optional(),
    },
    (args: any) => handleUpdateCategory(ctx, args),
  );

  server.tool(
    "delete_category",
    "Delete a category by slug.",
    { slug: z.string() },
    (args) => handleDeleteCategory(ctx, args),
  );

  return server;
}
