// ---------------------------------------------------------------------------
// Entity-Driven MCP Framework — ID/Slug Resolution
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";

export type IdOrSlug = { id?: string; slug?: string };

export type ResolveResult =
  | { type: "id"; value: string }
  | { type: "slug"; value: string }
  | { error: string };

/**
 * Validate that exactly one of id or slug is provided.
 * Both → error. Neither → error.
 */
export function validateIdOrSlug(args: IdOrSlug): ResolveResult {
  if (args.id && args.slug)
    return { error: "Provide either id or slug, not both." };
  if (args.id) return { type: "id", value: args.id };
  if (args.slug) return { type: "slug", value: args.slug };
  return { error: "Either id or slug is required." };
}

/**
 * Resolve an entity by id or slug. Returns the entity or an error object.
 * Decoupled from specific entities — takes lookup functions as parameters.
 */
export async function resolveEntity<T>(
  db: Db,
  args: IdOrSlug,
  getById: (db: Db, id: string) => Promise<T | null>,
  getBySlug: (db: Db, slug: string) => Promise<T | null>,
  displayName?: string,
): Promise<T | { error: string }> {
  const v = validateIdOrSlug(args);
  if ("error" in v) return v;
  const entity =
    v.type === "id" ? await getById(db, v.value) : await getBySlug(db, v.value);
  if (!entity) {
    const label = displayName ?? "Entity";
    return { error: `${label} not found: ${v.value}` };
  }
  return entity;
}
