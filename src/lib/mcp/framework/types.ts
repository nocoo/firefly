// ---------------------------------------------------------------------------
// Entity-Driven MCP Framework — Core Types
// Zero domain imports. Fully reusable across projects.
// ---------------------------------------------------------------------------

import type { z } from "zod";
import type { Db } from "@/lib/db";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// ---- Context ----

export interface ToolContext {
  db: Db;
}

// ---- Data layer contract ----

export interface DataLayer<T> {
  list: (
    db: Db,
    opts?: unknown,
  ) => Promise<T[] | { items: T[]; total: number }>;
  getById: (db: Db, id: string, args?: unknown) => Promise<T | null>;
  getBySlug: (db: Db, slug: string, args?: unknown) => Promise<T | null>;
  // Entity implementations use concrete input types; DataLayer is intentionally
  // loose so EntityConfig can host heterogeneous CRUD modules.
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous entity create inputs
  create: (db: Db, input: any) => Promise<T>;
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous entity update inputs
  update: (db: Db, id: string, input: any) => Promise<T | null>;
  delete: (db: Db, id: string, args?: unknown) => Promise<boolean>;
}

// ---- Lifecycle hooks ----

export interface EntityHooks<T> {
  /** Transform entity after get (e.g., enrich with relations). */
  afterGet?: (ctx: ToolContext, entity: T) => Promise<unknown>;
  /** Run after create (e.g., set relations). Best-effort — failure is logged, not rolled back. */
  afterCreate?: (
    ctx: ToolContext,
    entity: T,
    args: Record<string, unknown>,
  ) => Promise<void>;
  /** Run after update (e.g., set relations). Best-effort — failure is logged, not rolled back. */
  afterUpdate?: (
    ctx: ToolContext,
    entity: T,
    args: Record<string, unknown>,
  ) => Promise<void>;
  /** Transform create args before passing to data layer. */
  mapCreateInput?: (args: Record<string, unknown>) => Record<string, unknown>;
  /** Transform update args before passing to data layer. */
  mapUpdateInput?: (args: Record<string, unknown>) => Record<string, unknown>;
}

// ---- Field projection ----

export interface ProjectionConfig {
  /** Fields to omit from list responses by default. */
  omit: string[];
  /** Named groups of omitted fields. Key = group name, value = field names. */
  groups: Record<string, string[]>;
}

// ---- Extra tools (non-CRUD) ----

export interface ExtraToolDef {
  name: string;
  description: string;
  schema: Record<string, z.ZodType>;
  handler: (
    ctx: ToolContext,
    args: Record<string, unknown>,
  ) => Promise<CallToolResult>;
}

// ---- CRUD operation names ----

export type CrudOp = "list" | "get" | "create" | "update" | "delete";

// ---- The main entity definition ----

export interface EntityConfig<T = unknown> {
  /** Singular entity name for tool naming: "tag" -> list_tags, get_tag, etc. */
  name: string;
  /** Display name for error messages: "Tag not found: ..." */
  display: string;
  /** Plural form for list tool naming. Default: name + "s". */
  plural?: string;
  /** Data layer implementation. */
  dataLayer: DataLayer<T>;
  /** Zod schemas for tool input validation. */
  schemas: {
    list?: Record<string, z.ZodType>;
    /** Extra fields for get tool (in addition to id/slug). */
    get?: Record<string, z.ZodType>;
    create: Record<string, z.ZodType>;
    update: Record<string, z.ZodType>;
    /** Extra fields for delete tool (in addition to id/slug). */
    delete?: Record<string, z.ZodType>;
  };
  /** Tool descriptions (optional overrides, sensible defaults generated). */
  descriptions?: {
    list?: string;
    get?: string;
    create?: string;
    update?: string;
    delete?: string;
  };
  /** Lifecycle hooks for entity-specific logic. */
  hooks?: EntityHooks<T>;
  /** Field projection config for context-efficient list responses. */
  projection?: ProjectionConfig;
  /** Additional non-CRUD tools. */
  extraTools?: ExtraToolDef[];
}
