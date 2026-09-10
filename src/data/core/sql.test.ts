import { describe, it, expect } from "vitest";
import { buildSetClauses } from "./sql";
import type { FieldDef } from "./types";

// ---------------------------------------------------------------------------
// buildSetClauses
// ---------------------------------------------------------------------------

describe("buildSetClauses", () => {
  const fieldMap: Record<string, FieldDef> = {
    name: { column: "name" },
    slug: { column: "slug" },
    description: { column: "description", nullable: true },
    sortOrder: { column: "sort_order" },
  };

  it("returns empty arrays for empty input", () => {
    const result = buildSetClauses({}, fieldMap);
    expect(result).toEqual({ setClauses: [], params: [] });
  });

  it("returns empty arrays when all values are undefined", () => {
    const result = buildSetClauses(
      { name: undefined, slug: undefined },
      fieldMap,
    );
    expect(result).toEqual({ setClauses: [], params: [] });
  });

  it("builds single field SET clause", () => {
    const result = buildSetClauses({ name: "Hello" }, fieldMap);
    expect(result.setClauses).toEqual(["name = ?"]);
    expect(result.params).toEqual(["Hello"]);
  });

  it("builds multiple field SET clauses", () => {
    const result = buildSetClauses(
      { name: "Hello", slug: "hello" },
      fieldMap,
    );
    expect(result.setClauses).toEqual(["name = ?", "slug = ?"]);
    expect(result.params).toEqual(["Hello", "hello"]);
  });

  it("passes null through as a param value", () => {
    const result = buildSetClauses(
      { description: null },
      fieldMap,
    );
    expect(result.setClauses).toEqual(["description = ?"]);
    expect(result.params).toEqual([null]);
  });

  it("skips fields not in the fieldMap", () => {
    const result = buildSetClauses(
      { name: "Hello", unknownField: "oops" } as Record<string, unknown>,
      fieldMap,
    );
    expect(result.setClauses).toEqual(["name = ?"]);
    expect(result.params).toEqual(["Hello"]);
  });

  it("handles all field types correctly", () => {
    const result = buildSetClauses(
      {
        name: "Updated",
        slug: "updated",
        description: null,
        sortOrder: 5,
      },
      fieldMap,
    );
    expect(result.setClauses).toHaveLength(4);
    expect(result.params).toEqual(["Updated", "updated", null, 5]);
    // Verify column name mapping
    expect(result.setClauses[3]).toBe("sort_order = ?");
  });

  it("does not append updated_at", () => {
    const result = buildSetClauses({ name: "Test" }, fieldMap);
    const hasUpdatedAt = result.setClauses.some((c) =>
      c.includes("updated_at"),
    );
    expect(hasUpdatedAt).toBe(false);
  });
});
