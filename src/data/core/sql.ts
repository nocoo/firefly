// ---------------------------------------------------------------------------
// SQL composition utilities for the entity data layer
// Replaces copy-pasted dynamic UPDATE builders across all entities
// ---------------------------------------------------------------------------

import type { FieldDef } from "./types";

// ---------------------------------------------------------------------------
// buildSetClauses
// ---------------------------------------------------------------------------

/**
 * Build dynamic SET clauses for UPDATE statements.
 *
 * - `undefined` values are skipped (no change requested)
 * - `null` values are passed through (SET col = NULL)
 * - Any other value is passed through as a param
 * - Does NOT append `updated_at` — caller decides
 *
 * @param input - camelCase key → value map (D5 convention)
 * @param fieldMap - camelCase key → FieldDef (column mapping)
 * @returns `{ setClauses: string[], params: unknown[] }` — empty arrays for no-op
 */
export function buildSetClauses(
  input: Record<string, unknown>,
  fieldMap: Record<string, FieldDef>,
): { setClauses: string[]; params: unknown[] } {
  const setClauses: string[] = [];
  const params: unknown[] = [];

  for (const [inputKey, fieldDef] of Object.entries(fieldMap)) {
    if (!(inputKey in input)) continue;
    const value = input[inputKey];
    if (value === undefined) continue;

    setClauses.push(`${fieldDef.column} = ?`);
    params.push(value);
  }

  return { setClauses, params };
}

// ---------------------------------------------------------------------------
// buildInsert
// ---------------------------------------------------------------------------

/**
 * Build an INSERT statement.
 *
 * @param table - SQL table name
 * @param columns - Column names for the INSERT
 * @param values - Values corresponding to columns
 * @returns `{ sql, params }`
 */
export function buildInsert(
  table: string,
  columns: string[],
  values: unknown[],
): { sql: string; params: unknown[] } {
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
  return { sql, params: values };
}

// ---------------------------------------------------------------------------
// buildWhere
// ---------------------------------------------------------------------------

/**
 * Join multiple WHERE conditions with AND.
 *
 * @param conditions - Array of `{ clause, params }` objects
 * @returns `{ clause, params }` — empty string if no conditions
 */
export function buildWhere(
  conditions: { clause: string; params: unknown[] }[],
): { clause: string; params: unknown[] } {
  if (conditions.length === 0) return { clause: "", params: [] };

  return {
    clause: conditions.map((c) => c.clause).join(" AND "),
    params: conditions.flatMap((c) => c.params),
  };
}

// ---------------------------------------------------------------------------
// buildPagination
// ---------------------------------------------------------------------------

/**
 * Build LIMIT + OFFSET clause for pagination.
 *
 * @param page - 1-based page number (defaults to 1)
 * @param pageSize - Items per page (defaults to 20)
 * @returns `{ clause, params }`
 */
export function buildPagination(
  page?: number,
  pageSize?: number,
): { clause: string; params: unknown[] } {
  const size = pageSize ?? 20;
  const offset = ((page ?? 1) - 1) * size;
  return { clause: "LIMIT ? OFFSET ?", params: [size, offset] };
}

// ---------------------------------------------------------------------------
// buildOrderBy
// ---------------------------------------------------------------------------

/**
 * Build ORDER BY clause with column whitelist validation.
 *
 * @param column - Column name to sort by
 * @param direction - "ASC" or "DESC" (defaults to "DESC")
 * @param allowedColumns - Whitelist of valid column names
 * @returns ORDER BY clause string
 * @throws Error if column is not in allowedColumns
 */
export function buildOrderBy(
  column: string,
  direction: "ASC" | "DESC" | undefined,
  allowedColumns: string[],
): string {
  if (!allowedColumns.includes(column)) {
    throw new Error(`Invalid order by column: ${column}`);
  }
  return `ORDER BY ${column} ${direction ?? "DESC"}`;
}
