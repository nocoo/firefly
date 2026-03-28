// ---------------------------------------------------------------------------
// Core types for the entity data layer
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Unix epoch seconds */
export type EpochSeconds = number;

// ---------------------------------------------------------------------------
// Base entity
// ---------------------------------------------------------------------------

/** All entities have at least an id and created_at */
export interface BaseEntity {
  id: string;
  created_at: EpochSeconds;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** Paginated list result */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

/** List query options */
export interface ListOptions {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
}

// ---------------------------------------------------------------------------
// Field definitions
// ---------------------------------------------------------------------------

/** Field definition for dynamic UPDATE — key is camelCase (D5), column is snake_case */
export interface FieldDef {
  /** DB column name (snake_case) */
  column: string;
  /**
   * If true, null means "clear this field" (SET col = NULL).
   * If false/omitted, null still passes through to DB — let the constraint reject it.
   */
  nullable?: boolean;
}

// ---------------------------------------------------------------------------
// Data-layer hooks
// ---------------------------------------------------------------------------

/** Data-layer hooks — input enrichment only, NO cross-entity side effects (D4) */
export interface DataHooks<T> {
  /** Enrich input before INSERT (e.g., compute readingTime, contentHtml) */
  beforeCreate?: (
    db: Db,
    input: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  /** Enrich input before UPDATE (e.g., recompute contentHtml when content changes) */
  beforeUpdate?: (
    db: Db,
    existing: T,
    input: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Entity configuration
// ---------------------------------------------------------------------------

/** Complete entity configuration */
export interface EntityConfig<T extends BaseEntity> {
  /** SQL table name */
  table: string;
  /** Display name for error messages */
  displayName: string;
  /** Has an updated_at column? (Attachment doesn't) */
  hasUpdatedAt: boolean;
  /** Has a slug column for lookup? */
  hasSlug: boolean;
  /** Field map for dynamic UPDATE: camelCase inputKey -> FieldDef (D5) */
  fields: Record<string, FieldDef>;
  /**
   * Column names for INSERT — uses camelCase keys matching fields (D5).
   * id, created_at, updated_at are auto-handled by BaseDataLayer.
   */
  insertColumns: string[];
  /**
   * Default ORDER BY clause content (without the "ORDER BY" keyword).
   * Supports multi-column: "sort_order DESC, name ASC".
   * Single-column: "name ASC".
   */
  defaultOrderBy: string;
  /**
   * List mode:
   * - "all": list() returns T[] (full array, no pagination). Used by Tag, Category.
   * - "paginated": list() returns PaginatedResult<T>. Used by Post, Media.
   * Default: "paginated"
   */
  listMode?: "all" | "paginated";
  /**
   * Optional: SELECT statement for reads (with JOINs). Omit for "SELECT * FROM {table}".
   * When defined, `tableAlias` MUST also be set.
   */
  viewQuery?: string;
  /**
   * Required when viewQuery is defined. The alias of the primary table in the viewQuery.
   * Used by getById/getBySlug/update/remove to qualify column references:
   * e.g., "p" -> WHERE p.id = ?, WHERE p.slug = ?
   * Omit for simple entities (no viewQuery) — BaseDataLayer uses bare "id"/"slug".
   */
  tableAlias?: string;
  /**
   * Optional: additional WHERE conditions for getBySlug resolve.
   * E.g., Post's public resolve needs status = 'published'.
   * Key = condition name, Value = { clause, params }
   */
  resolveFilters?: Record<string, { clause: string; params: unknown[] }>;
  /** Data-layer hooks */
  hooks?: DataHooks<T>;
  /** Cache policy — only used when listMode is "all" (cache the full array) */
  cache?: { ttl: number };
  /**
   * Custom list implementation (for complex JOINs/filters like Post, Media).
   * Only valid when listMode is "paginated". Overrides default pagination query.
   */
  customList?: (db: Db, options: unknown) => Promise<PaginatedResult<T>>;
}
