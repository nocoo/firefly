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
export function buildSetClauses<T extends object>(
  input: T,
  fieldMap: Record<string, FieldDef>,
): { setClauses: string[]; params: unknown[] } {
  const setClauses: string[] = [];
  const params: unknown[] = [];

  for (const [inputKey, fieldDef] of Object.entries(fieldMap)) {
    if (!(inputKey in input)) continue;
    const value = (input as Record<string, unknown>)[inputKey];
    if (value === undefined) continue;

    setClauses.push(`${fieldDef.column} = ?`);
    params.push(value);
  }

  return { setClauses, params };
}
