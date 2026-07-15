// ---------------------------------------------------------------------------
// Entity-Driven MCP Framework — Tool Registration Engine
//
// Reads an EntityConfig and registers all CRUD tools + extra tools on an
// McpServer instance. This is the bridge between the framework and the SDK.
// ---------------------------------------------------------------------------
//
// Zod v4 ShapeOutput uses `T | undefined` for optional properties, which
// conflicts with TypeScript's exactOptionalPropertyTypes. We cast tool
// callbacks to `any` where needed — the Zod schema validates inputs at
// runtime, and the handler functions have their own typed parameters.

// biome-ignore-all lint/suspicious/noExplicitAny: Zod v4 ShapeOutput + exactOptionalPropertyTypes forces tool callback casts; schemas validate at runtime

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CrudOp, EntityConfig, ToolContext } from "./types";
import { createCrudHandlers } from "./handlers";

export interface RegisterOptions {
  /** Operations to disable (skip registering). */
  disabledOps?: CrudOp[];
}

export function registerEntityTools<T extends { id: string }>(
  server: McpServer,
  config: EntityConfig<T>,
  ctx: ToolContext,
  options?: RegisterOptions,
): void {
  const plural = config.plural ?? `${config.name}s`;
  const handlers = createCrudHandlers(config);
  const disabled = new Set(options?.disabledOps ?? []);

  // ---- list ----
  if (!disabled.has("list")) {
    server.tool(
      `list_${plural}`,
      config.descriptions?.list ?? `List all ${plural}.`,
      {
        ...config.schemas.list,
        ...(config.projection
          ? {
              include: z
                .array(z.string())
                .optional()
                .describe(
                  "Opt-in fields excluded by default. Use 'full' for all fields.",
                ),
            }
          : {}),
      } as any,
      ((args: any) => handlers.handleList(ctx, args)) as any,
    );
  }

  // ---- get ----
  if (!disabled.has("get")) {
    server.tool(
      `get_${config.name}`,
      config.descriptions?.get ??
        `Get a single ${config.display} by id or slug (exactly one required).`,
      {
        id: z.string().optional(),
        slug: z.string().optional(),
        ...config.schemas.get,
      } as any,
      ((args: any) => handlers.handleGet(ctx, args)) as any,
    );
  }

  // ---- create ----
  if (!disabled.has("create")) {
    server.tool(
      `create_${config.name}`,
      config.descriptions?.create ?? `Create a new ${config.display}.`,
      config.schemas.create as any,
      ((args: any) => handlers.handleCreate(ctx, args)) as any,
    );
  }

  // ---- update ----
  if (!disabled.has("update")) {
    server.tool(
      `update_${config.name}`,
      config.descriptions?.update ??
        `Update an existing ${config.display} by id or slug (exactly one required).`,
      {
        id: z.string().optional(),
        slug: z.string().optional(),
        ...config.schemas.update,
      } as any,
      ((args: any) => handlers.handleUpdate(ctx, args)) as any,
    );
  }

  // ---- delete ----
  if (!disabled.has("delete")) {
    server.tool(
      `delete_${config.name}`,
      config.descriptions?.delete ??
        `Delete a ${config.display} by id or slug (exactly one required). Irreversible.`,
      {
        id: z.string().optional(),
        slug: z.string().optional(),
        ...config.schemas.delete,
      } as any,
      ((args: any) => handlers.handleDelete(ctx, args)) as any,
    );
  }

  // ---- extra tools ----
  for (const extra of config.extraTools ?? []) {
    server.tool(
      extra.name,
      extra.description,
      extra.schema as any,
      ((args: any) => extra.handler(ctx, args)) as any,
    );
  }
}
