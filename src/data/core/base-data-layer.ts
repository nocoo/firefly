// ---------------------------------------------------------------------------
// Base data layer — generic CRUD with viewQuery support
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { BaseEntity, EntityConfig, ListOptions, PaginatedResult } from "./types";
import { buildSetClauses, buildInsert, buildPagination, buildWhere, buildOrderBy } from "./sql";
import { nowEpoch, newId } from "./timestamps";

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

/**
 * List entities. Behavior depends on `config.listMode`:
 * - `"all"` (Tag, Category): returns T[] (full array)
 * - `"paginated"` (Post, Media, default): returns PaginatedResult<T>
 *   If `config.customList` is defined, delegates to it.
 *
 * Note: Caching for `listMode: "all"` is handled by entity wrapper functions,
 * not here. This keeps the base layer pure and testable.
 */
export async function list<T extends BaseEntity>(
  db: Db,
  config: EntityConfig<T>,
  options?: ListOptions,
): Promise<T[] | PaginatedResult<T>> {
  const orderByClause = resolveOrderBy(config, options);

  // "all" mode — full array, no pagination
  if (config.listMode === "all") {
    const sql = `SELECT * FROM ${config.table} ${orderByClause}`;
    const result = await db.query<T>(sql);
    return result.results;
  }

  // Custom list for complex entities (Post, Media)
  if (config.customList) {
    return config.customList(db, options);
  }

  // Default paginated list
  const pagination = buildPagination(options?.page, options?.pageSize);

  const sql = [
    `SELECT * FROM ${config.table}`,
    orderByClause,
    pagination.clause,
  ].join(" ");

  const result = await db.query<T>(sql, pagination.params);

  // Count query
  const countSql = `SELECT COUNT(*) AS count FROM ${config.table}`;
  const countResult = await db.firstOrNull<{ count: number }>(countSql);
  const total = countResult?.count ?? 0;

  return { items: result.results, total };
}

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------

export async function getById<T extends BaseEntity>(
  db: Db,
  config: EntityConfig<T>,
  id: string,
): Promise<T | null> {
  const sql = buildReadQuery(config);
  const whereCol = config.tableAlias ? `${config.tableAlias}.id` : "id";
  return db.firstOrNull<T>(`${sql} WHERE ${whereCol} = ?`, [id]);
}

// ---------------------------------------------------------------------------
// getBySlug
// ---------------------------------------------------------------------------

export async function getBySlug<T extends BaseEntity>(
  db: Db,
  config: EntityConfig<T>,
  slug: string,
  resolveFilter?: string,
): Promise<T | null> {
  const conditions: { clause: string; params: unknown[] }[] = [];

  const slugCol = config.tableAlias ? `${config.tableAlias}.slug` : "slug";
  conditions.push({ clause: `${slugCol} = ?`, params: [slug] });

  if (resolveFilter && config.resolveFilters?.[resolveFilter]) {
    conditions.push(config.resolveFilters[resolveFilter]);
  }

  const where = buildWhere(conditions);
  const sql = `${buildReadQuery(config)} WHERE ${where.clause}`;
  return db.firstOrNull<T>(sql, where.params);
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

export async function create<T extends BaseEntity>(
  db: Db,
  config: EntityConfig<T>,
  input: Record<string, unknown>,
): Promise<T> {
  const id = newId();
  const now = nowEpoch();

  // Run beforeCreate hook (input enrichment only — D4)
  let enriched = { ...input };
  if (config.hooks?.beforeCreate) {
    enriched = await config.hooks.beforeCreate(db, enriched);
  }

  // Build column list: insertColumns + id + created_at [+ updated_at]
  const columns = [...config.insertColumns, "id", "created_at"];
  if (config.hasUpdatedAt) {
    columns.push("updated_at");
  }

  // Build values from enriched input
  const values: unknown[] = [];
  for (const col of config.insertColumns) {
    values.push(enriched[col] ?? null);
  }
  values.push(id, now);
  if (config.hasUpdatedAt) {
    values.push(now);
  }

  const { sql, params } = buildInsert(config.table, columns, values);
  await db.execute(sql, params);

  const entity = await getById(db, config, id);
  if (!entity) {
    throw new Error(`Failed to retrieve ${config.displayName} ${id} after creation`);
  }
  return entity;
}

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

export async function update<T extends BaseEntity>(
  db: Db,
  config: EntityConfig<T>,
  id: string,
  input: Record<string, unknown>,
): Promise<T | null> {
  // Fetch existing for beforeUpdate hook
  const existing = await getById(db, config, id);
  if (!existing) return null;

  // Run beforeUpdate hook (input enrichment — D4)
  let enriched = { ...input };
  if (config.hooks?.beforeUpdate) {
    enriched = await config.hooks.beforeUpdate(db, existing, enriched);
  }

  // Build SET clauses from field map
  const { setClauses, params } = buildSetClauses(enriched, config.fields);
  if (setClauses.length === 0) return existing;

  // Append updated_at if entity has it
  if (config.hasUpdatedAt) {
    setClauses.push("updated_at = ?");
    params.push(nowEpoch());
  }

  params.push(id);

  const sql = `UPDATE ${config.table} SET ${setClauses.join(", ")} WHERE id = ?`;
  await db.execute(sql, params);

  // Fetch back using viewQuery (for JOIN entities like Post)
  return getById(db, config, id);
}

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

export async function remove<T extends BaseEntity>(
  db: Db,
  config: EntityConfig<T>,
  id: string,
): Promise<boolean> {
  const result = await db.execute(
    `DELETE FROM ${config.table} WHERE id = ?`,
    [id],
  );
  return result.changes > 0;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildReadQuery<T extends BaseEntity>(config: EntityConfig<T>): string {
  if (config.viewQuery) return config.viewQuery;
  return `SELECT * FROM ${config.table}`;
}

/**
 * Resolve ORDER BY clause from options + config.
 * If options.orderBy is set and config.allowedOrderColumns includes it,
 * use buildOrderBy for validated sorting. Otherwise fall back to defaultOrderBy.
 */
function resolveOrderBy<T extends BaseEntity>(
  config: EntityConfig<T>,
  options?: ListOptions,
): string {
  if (
    options?.orderBy &&
    config.allowedOrderColumns &&
    config.allowedOrderColumns.length > 0
  ) {
    return buildOrderBy(
      options.orderBy,
      options.orderDirection,
      config.allowedOrderColumns,
    );
  }
  return `ORDER BY ${config.defaultOrderBy}`;
}
