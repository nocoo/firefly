// ---------------------------------------------------------------------------
// Taxonomy factory — generic CRUD for tag-like entities (tags, categories)
// Eliminates ~80% duplicated code between tag.ts and category.ts
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { FieldDef } from "@/data/core/types";
import { EntityCacheManager } from "@/data/core/cache-manager";
import { nowEpoch, newId } from "@/data/core/timestamps";
import { buildSetClauses } from "@/data/core/sql";

// ---------------------------------------------------------------------------
// Config & return types
// ---------------------------------------------------------------------------

// T and UpdateInput are unused here but kept so Config and Entity share the
// same <T, CreateInput, UpdateInput> parameter list — callers only specify
// the triple once on `createTaxonomyEntity`.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface TaxonomyConfig<T, CreateInput, UpdateInput> {
  /** SQL table name (e.g. "tags", "categories") */
  table: string;
  /** Human-readable name for error messages (e.g. "Tag", "Category") */
  entityName: string;
  /** camelCase → column mapping for dynamic UPDATE */
  fields: Record<string, FieldDef>;
  /** ORDER BY clause for list (e.g. "name ASC") */
  orderBy: string;
  /** Cache TTL in milliseconds */
  cacheTtl: number;
  /** Column names for INSERT statement */
  insertColumns: string[];
  /** Build parameter array for INSERT from (id, input, nowEpoch) */
  buildInsertParams: (id: string, input: CreateInput, now: number) => unknown[];
}

export interface TaxonomyEntity<T, CreateInput, UpdateInput> {
  list: (db: Db) => Promise<T[]>;
  getBySlug: (db: Db, slug: string) => Promise<T | null>;
  getById: (db: Db, id: string) => Promise<T | null>;
  create: (db: Db, input: CreateInput) => Promise<T>;
  update: (db: Db, id: string, input: UpdateInput) => Promise<T | null>;
  delete: (db: Db, id: string) => Promise<boolean>;
  invalidateCache: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTaxonomyEntity<T, CreateInput, UpdateInput extends object>(
  config: TaxonomyConfig<T, CreateInput, UpdateInput>,
): TaxonomyEntity<T, CreateInput, UpdateInput> {
  const { table, entityName, fields, orderBy, cacheTtl, insertColumns, buildInsertParams } =
    config;

  const cache = new EntityCacheManager<T[]>(cacheTtl);

  const placeholders = insertColumns.map(() => "?").join(", ");
  const insertSql = `INSERT INTO ${table} (${insertColumns.join(", ")}) VALUES (${placeholders})`;

  // -- list ----------------------------------------------------------------
  async function list(db: Db): Promise<T[]> {
    const cached = cache.get();
    if (cached) return cached;

    const result = await db.query<T>(`SELECT * FROM ${table} ORDER BY ${orderBy}`);
    cache.set(result.results);
    return result.results;
  }

  // -- getBySlug -----------------------------------------------------------
  async function getBySlug(db: Db, slug: string): Promise<T | null> {
    return db.firstOrNull<T>(`SELECT * FROM ${table} WHERE slug = ?`, [slug]);
  }

  // -- getById -------------------------------------------------------------
  async function getById(db: Db, id: string): Promise<T | null> {
    return db.firstOrNull<T>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  }

  // -- create --------------------------------------------------------------
  async function create(db: Db, input: CreateInput): Promise<T> {
    const id = newId();
    const now = nowEpoch();

    await db.execute(insertSql, buildInsertParams(id, input, now));

    const row = await getById(db, id);
    if (!row) throw new Error(`Failed to retrieve ${entityName} ${id} after creation`);
    cache.invalidate();
    return row;
  }

  // -- update --------------------------------------------------------------
  async function update(db: Db, id: string, input: UpdateInput): Promise<T | null> {
    if (Object.keys(input).length === 0) return getById(db, id);

    const { setClauses, params } = buildSetClauses(input, fields);
    if (setClauses.length === 0) return getById(db, id);

    setClauses.push("updated_at = ?");
    params.push(nowEpoch());
    params.push(id);

    await db.execute(`UPDATE ${table} SET ${setClauses.join(", ")} WHERE id = ?`, params);

    cache.invalidate();
    return getById(db, id);
  }

  // -- delete --------------------------------------------------------------
  async function del(db: Db, id: string): Promise<boolean> {
    const meta = await db.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
    if (meta.changes > 0) cache.invalidate();
    return meta.changes > 0;
  }

  // -- invalidateCache -----------------------------------------------------
  function invalidateCache(): void {
    cache.invalidate();
  }

  return { list, getBySlug, getById, create, update, delete: del, invalidateCache };
}
