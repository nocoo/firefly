import { describe, it, expect } from "vitest";
import { validateIdOrSlug, resolveEntity } from "./resolve";

// ---------------------------------------------------------------------------
// validateIdOrSlug
// ---------------------------------------------------------------------------

describe("validateIdOrSlug", () => {
  it("returns id result when only id is provided", () => {
    const result = validateIdOrSlug({ id: "abc-123" });
    expect(result).toEqual({ type: "id", value: "abc-123" });
  });

  it("returns slug result when only slug is provided", () => {
    const result = validateIdOrSlug({ slug: "my-tag" });
    expect(result).toEqual({ type: "slug", value: "my-tag" });
  });

  it("returns error when both id and slug are provided", () => {
    const result = validateIdOrSlug({ id: "abc", slug: "my-tag" });
    expect(result).toEqual({
      error: "Provide either id or slug, not both.",
    });
  });

  it("returns error when neither id nor slug is provided", () => {
    const result = validateIdOrSlug({});
    expect(result).toEqual({ error: "Either id or slug is required." });
  });

  it("treats empty string id as falsy (no id)", () => {
    const result = validateIdOrSlug({ id: "", slug: "my-tag" });
    expect(result).toEqual({ type: "slug", value: "my-tag" });
  });

  it("treats empty string slug as falsy (no slug)", () => {
    const result = validateIdOrSlug({ id: "abc", slug: "" });
    expect(result).toEqual({ type: "id", value: "abc" });
  });
});

// ---------------------------------------------------------------------------
// resolveEntity
// ---------------------------------------------------------------------------

describe("resolveEntity", () => {
  const mockDb = {} as Parameters<typeof resolveEntity>[0];

  const getById = async (_db: unknown, id: string) =>
    id === "id-1" ? { id: "id-1", name: "Found" } : null;
  const getBySlug = async (_db: unknown, slug: string) =>
    slug === "found-slug" ? { id: "id-1", name: "Found" } : null;

  it("resolves entity by id", async () => {
    const result = await resolveEntity(mockDb, { id: "id-1" }, getById, getBySlug);
    expect(result).toEqual({ id: "id-1", name: "Found" });
  });

  it("resolves entity by slug", async () => {
    const result = await resolveEntity(
      mockDb,
      { slug: "found-slug" },
      getById,
      getBySlug,
    );
    expect(result).toEqual({ id: "id-1", name: "Found" });
  });

  it("returns error when entity not found by id", async () => {
    const result = await resolveEntity(
      mockDb,
      { id: "missing" },
      getById,
      getBySlug,
    );
    expect(result).toEqual({ error: "Entity not found: missing" });
  });

  it("returns error when entity not found by slug", async () => {
    const result = await resolveEntity(
      mockDb,
      { slug: "missing" },
      getById,
      getBySlug,
    );
    expect(result).toEqual({ error: "Entity not found: missing" });
  });

  it("uses displayName in not-found error", async () => {
    const result = await resolveEntity(
      mockDb,
      { id: "missing" },
      getById,
      getBySlug,
      "Tag",
    );
    expect(result).toEqual({ error: "Tag not found: missing" });
  });

  it("returns error when both id and slug provided", async () => {
    const result = await resolveEntity(
      mockDb,
      { id: "id-1", slug: "found-slug" },
      getById,
      getBySlug,
    );
    expect(result).toEqual({
      error: "Provide either id or slug, not both.",
    });
  });

  it("returns error when neither provided", async () => {
    const result = await resolveEntity(mockDb, {}, getById, getBySlug);
    expect(result).toEqual({ error: "Either id or slug is required." });
  });
});
