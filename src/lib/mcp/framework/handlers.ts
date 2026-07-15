// ---------------------------------------------------------------------------
// Entity-Driven MCP Framework — Generic CRUD Handler Factory
//
// Given an EntityConfig, produces 5 typed handler functions:
// handleList, handleGet, handleCreate, handleUpdate, handleDelete
// ---------------------------------------------------------------------------

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { EntityConfig, ToolContext } from "./types";
import type { IdOrSlug } from "./resolve";
import { resolveEntity } from "./resolve";
import { ok, error } from "./response";
import { projectFields } from "./projection";

export function createCrudHandlers<T extends { id: string }>(
  config: EntityConfig<T>,
) {
  const { dataLayer, hooks, projection } = config;
  const displayName = config.display;

  // Helper: resolve with entity-specific not-found message.
  function resolve(db: Parameters<typeof resolveEntity>[0], args: IdOrSlug & Record<string, unknown>) {
    return resolveEntity(
      db,
      args,
      (db, id) => dataLayer.getById(db, id, args),
      (db, slug) => dataLayer.getBySlug(db, slug, args),
      displayName,
    );
  }

  // ---- list ----
  async function handleList(
    ctx: ToolContext,
    args: Record<string, unknown>,
  ): Promise<CallToolResult> {
    const result = await dataLayer.list(ctx.db, args);

    // Paginated result { items, total }
    if (result && typeof result === "object" && "items" in result) {
      const items = projection
        ? result.items.map((item) =>
            projectFields(
              item as Record<string, unknown>,
              projection,
              args.include as string[] | undefined,
            ),
          )
        : result.items;
      return ok({
        [config.plural ?? `${config.name}s`]: items,
        total: result.total,
      });
    }

    // Simple array
    const items = result as T[];
    return ok(
      projection
        ? items.map((item) =>
            projectFields(
              item as Record<string, unknown>,
              projection,
              args.include as string[] | undefined,
            ),
          )
        : items,
    );
  }

  // ---- get ----
  async function handleGet(
    ctx: ToolContext,
    args: IdOrSlug & Record<string, unknown>,
  ): Promise<CallToolResult> {
    const resolved = await resolve(ctx.db, args);
    if ("error" in resolved) return error(resolved.error);
    const enriched = hooks?.afterGet
      ? await hooks.afterGet(ctx, resolved)
      : resolved;
    return ok(enriched);
  }

  // ---- create ----
  async function handleCreate(
    ctx: ToolContext,
    args: Record<string, unknown>,
  ): Promise<CallToolResult> {
    const input = hooks?.mapCreateInput ? hooks.mapCreateInput(args) : args;
    const entity = await dataLayer.create(ctx.db, input);
    if (hooks?.afterCreate) {
      try {
        await hooks.afterCreate(ctx, entity, args);
      } catch (err) {
        console.error(
          `[MCP] ${displayName} afterCreate hook failed (best-effort):`,
          err,
        );
      }
    }
    return ok(entity);
  }

  // ---- update ----
  async function handleUpdate(
    ctx: ToolContext,
    args: IdOrSlug & Record<string, unknown>,
  ): Promise<CallToolResult> {
    const resolved = await resolve(ctx.db, args);
    if ("error" in resolved) return error(resolved.error);

    // Strip MCP identifier fields before any hook/mapper sees the args.
    const { id: _id, slug: _slug, ...businessFields } = args;

    // Map business fields for data layer (e.g., new_slug -> slug).
    const input = hooks?.mapUpdateInput
      ? hooks.mapUpdateInput(businessFields)
      : businessFields;

    const updated = await dataLayer.update(ctx.db, resolved.id, input);
    if (!updated) return error(`${displayName} not found: ${resolved.id}`);

    if (hooks?.afterUpdate) {
      try {
        await hooks.afterUpdate(ctx, updated, businessFields);
      } catch (err) {
        console.error(
          `[MCP] ${displayName} afterUpdate hook failed (best-effort):`,
          err,
        );
      }
    }

    return ok(updated);
  }

  // ---- delete ----
  async function handleDelete(
    ctx: ToolContext,
    args: IdOrSlug & Record<string, unknown>,
  ): Promise<CallToolResult> {
    const resolved = await resolve(ctx.db, args);
    if ("error" in resolved) return error(resolved.error);
    await dataLayer.delete(ctx.db, resolved.id, args);
    return ok({ deleted: true });
  }

  return { handleList, handleGet, handleCreate, handleUpdate, handleDelete };
}
