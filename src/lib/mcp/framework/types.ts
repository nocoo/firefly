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

export interface DataLayer<
  T,
  TCreate = Record<string, unknown>,
  TUpdate = Record<string, unknown>,
> {
  list: (
    db: Db,
    opts?: unknown,
  ) => Promise<T[] | { items: T[]; total: number }>;
  getById: (db: Db, id: string) => Promise<T | null>;
  getBySlug: (db: Db, slug: string) => Promise<T | null>;
  create: (db: Db, input: TCreate) => Promise<T>;
  update: (db: Db, id: string, input: TUpdate) => Promise<T | null>;
  delete: (db: Db, id: string) => Promise<boolean>;
}

// ---- Lifecycle hooks ----

export interface EntityHooks<T> {
  /** Transform entity after get (e.g., enrich with relations). */
  afterGet?: (ctx: ToolContext, entity: T) => Promise<unknown>;
  /** Run after create (e.g., set relations). Throw to trigger rollback. */
  afterCreate?: (
    ctx: ToolContext,
    entity: T,
    args: Record<string, unknown>,
  ) => Promise<void>;
  /** Rollback create if afterCreate fails (e.g., delete orphan). */
  onCreateRollback?: (ctx: ToolContext, entity: T) => Promise<void>;
  /** Run before update. Returns rollback data for compensating write. */
  beforeUpdate?: (
    ctx: ToolContext,
    existing: T,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
  /** Restore pre-update state if update fails. */
  onUpdateRollback?: (
    ctx: ToolContext,
    existing: T,
    rollbackData: unknown,
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
    create: Record<string, z.ZodType>;
    update: Record<string, z.ZodType>;
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
