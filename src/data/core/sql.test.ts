import { describe, it, expect } from "vitest";
import {
  buildSetClauses,
  buildInsert,
  buildWhere,
  buildPagination,
  buildOrderBy,
} from "./sql";
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

// ---------------------------------------------------------------------------
// buildInsert
// ---------------------------------------------------------------------------

describe("buildInsert", () => {
  it("builds single column INSERT", () => {
    const result = buildInsert("tags", ["name"], ["Hello"]);
    expect(result.sql).toBe("INSERT INTO tags (name) VALUES (?)");
    expect(result.params).toEqual(["Hello"]);
  });

  it("builds multi-column INSERT", () => {
    const result = buildInsert(
      "tags",
      ["id", "name", "slug"],
      ["ulid-1", "Hello", "hello"],
    );
    expect(result.sql).toBe(
      "INSERT INTO tags (id, name, slug) VALUES (?, ?, ?)",
    );
    expect(result.params).toEqual(["ulid-1", "Hello", "hello"]);
  });

  it("placeholder count matches column count", () => {
    const cols = ["a", "b", "c", "d"];
    const vals = [1, 2, 3, 4];
    const result = buildInsert("test", cols, vals);
    const placeholders = result.sql.match(/\?/g);
    expect(placeholders).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// buildWhere
// ---------------------------------------------------------------------------

describe("buildWhere", () => {
  it("returns empty clause for no conditions", () => {
    const result = buildWhere([]);
    expect(result.clause).toBe("");
    expect(result.params).toEqual([]);
  });

  it("builds single condition", () => {
    const result = buildWhere([{ clause: "id = ?", params: ["123"] }]);
    expect(result.clause).toBe("id = ?");
    expect(result.params).toEqual(["123"]);
  });

  it("joins multiple conditions with AND", () => {
    const result = buildWhere([
      { clause: "status = ?", params: ["published"] },
      { clause: "category_id = ?", params: ["cat-1"] },
    ]);
    expect(result.clause).toBe("status = ? AND category_id = ?");
    expect(result.params).toEqual(["published", "cat-1"]);
  });

  it("merges params from all conditions", () => {
    const result = buildWhere([
      { clause: "a = ?", params: [1] },
      { clause: "b = ?", params: [2, 3] },
      { clause: "c = ?", params: [4] },
    ]);
    expect(result.params).toEqual([1, 2, 3, 4]);
  });
});

// ---------------------------------------------------------------------------
// buildPagination
// ---------------------------------------------------------------------------

describe("buildPagination", () => {
  it("page 1 has offset 0", () => {
    const result = buildPagination(1, 20);
    expect(result.clause).toBe("LIMIT ? OFFSET ?");
    expect(result.params).toEqual([20, 0]);
  });

  it("page N has correct offset", () => {
    const result = buildPagination(3, 10);
    expect(result.params).toEqual([10, 20]);
  });

  it("uses default page size of 20", () => {
    const result = buildPagination(2);
    expect(result.params).toEqual([20, 20]);
  });

  it("defaults to page 1", () => {
    const result = buildPagination(undefined, 10);
    expect(result.params).toEqual([10, 0]);
  });
});

// ---------------------------------------------------------------------------
// buildOrderBy
// ---------------------------------------------------------------------------

describe("buildOrderBy", () => {
  const allowedColumns = ["published_at", "created_at", "name"];

  it("returns ORDER BY clause for valid column", () => {
    expect(buildOrderBy("published_at", "DESC", allowedColumns)).toBe(
      "ORDER BY published_at DESC",
    );
  });

  it("returns ORDER BY with ASC direction", () => {
    expect(buildOrderBy("name", "ASC", allowedColumns)).toBe(
      "ORDER BY name ASC",
    );
  });

  it("defaults to DESC when direction is undefined", () => {
    expect(buildOrderBy("created_at", undefined, allowedColumns)).toBe(
      "ORDER BY created_at DESC",
    );
  });

  it("throws for disallowed column", () => {
    expect(() => buildOrderBy("drop_table", "ASC", allowedColumns)).toThrow(
      "Invalid order by column",
    );
  });

  it("throws for empty allowed columns list", () => {
    expect(() => buildOrderBy("anything", "ASC", [])).toThrow(
      "Invalid order by column",
    );
  });
});
