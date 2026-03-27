// ---------------------------------------------------------------------------
// Entity-Driven MCP Framework — Field Projection Engine
// ---------------------------------------------------------------------------

import type { ProjectionConfig } from "./types";

/**
 * Remove omitted fields from a record, unless included via named groups.
 *
 * - Default: omit all fields in `config.omit`
 * - If `include` contains a group name, restore those fields
 * - If `include` contains `"full"`, return the record unchanged
 */
export function projectFields<T extends Record<string, unknown>>(
  record: T,
  config: ProjectionConfig,
  include?: string[],
): Record<string, unknown> {
  // "full" bypass — return everything
  if (include?.includes("full")) return { ...record };

  // Resolve which fields should be restored from omit list
  const included = new Set(
    (include ?? []).flatMap((key) => config.groups[key] ?? []),
  );

  // Build omit set (fields to drop minus included overrides)
  const omitSet = new Set(config.omit.filter((k) => !included.has(k)));

  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !omitSet.has(key)),
  );
}
