// ---------------------------------------------------------------------------
// MCP Tag tools — CRUD for blog tags
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import {
  listTags,
  getTagBySlug,
  createTag,
  updateTag,
  deleteTag,
} from "@/data/tags";

export interface ToolContext {
  db: Db;
}

// ---------------------------------------------------------------------------
// list_tags
// ---------------------------------------------------------------------------

export async function handleListTags(ctx: ToolContext) {
  const tags = await listTags(ctx.db);

  return {
    content: [{ type: "text" as const, text: JSON.stringify(tags, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// get_tag
// ---------------------------------------------------------------------------

export async function handleGetTag(
  ctx: ToolContext,
  args: { slug: string },
) {
  const tag = await getTagBySlug(ctx.db, args.slug);
  if (!tag) {
    return {
      content: [{ type: "text" as const, text: `Tag not found: ${args.slug}` }],
      isError: true,
    };
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify(tag, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// create_tag
// ---------------------------------------------------------------------------

export async function handleCreateTag(
  ctx: ToolContext,
  args: { name: string; slug: string },
) {
  const tag = await createTag(ctx.db, {
    name: args.name,
    slug: args.slug,
  });

  return {
    content: [{ type: "text" as const, text: JSON.stringify(tag, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// update_tag
// ---------------------------------------------------------------------------

export async function handleUpdateTag(
  ctx: ToolContext,
  args: { slug: string; name?: string; new_slug?: string },
) {
  const existing = await getTagBySlug(ctx.db, args.slug);
  if (!existing) {
    return {
      content: [{ type: "text" as const, text: `Tag not found: ${args.slug}` }],
      isError: true,
    };
  }

  const updated = await updateTag(ctx.db, existing.id, {
    name: args.name,
    slug: args.new_slug,
  });

  return {
    content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// delete_tag
// ---------------------------------------------------------------------------

export async function handleDeleteTag(
  ctx: ToolContext,
  args: { slug: string },
) {
  const existing = await getTagBySlug(ctx.db, args.slug);
  if (!existing) {
    return {
      content: [{ type: "text" as const, text: `Tag not found: ${args.slug}` }],
      isError: true,
    };
  }

  await deleteTag(ctx.db, existing.id);

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ deleted: true }) }],
  };
}
