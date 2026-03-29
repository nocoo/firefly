import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import { createTaxonomyEntity } from "./taxonomy-factory";

// ---------------------------------------------------------------------------
// Test entity type & config
// ---------------------------------------------------------------------------

interface Widget {
  id: string;
  name: string;
  slug: string;
  created_at: number;
  updated_at: number;
}

interface CreateWidgetInput {
  name: string;
  slug: string;
}

interface UpdateWidgetInput {
  name?: string;
  slug?: string;
}

function makeEntity() {
  return createTaxonomyEntity<Widget, CreateWidgetInput, UpdateWidgetInput>({
    table: "widgets",
    entityName: "Widget",
    fields: {
      name: { column: "name" },
      slug: { column: "slug" },
    },
    orderBy: "name ASC",
    cacheTtl: 5 * 60 * 1000,
    insertColumns: ["id", "name", "slug", "created_at", "updated_at"],
    buildInsertParams: (id: string, input: CreateWidgetInput, now: number) => [id, input.name, input.slug, now, now],
  });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = Math.floor(Date.now() / 1000);
const sampleWidget: Widget = {
  id: "w-1",
  name: "Gear",
  slug: "gear",
  created_at: now,
  updated_at: now,
};

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

describe("taxonomy factory — list", () => {
  let db: Db;
  let entity: ReturnType<typeof makeEntity>;

  beforeEach(() => {
    db = createMockDb();
    entity = makeEntity(); // fresh cache per test
  });

  it("selects with correct ORDER BY", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleWidget],
      meta: { changes: 0, duration: 1 },
    });

    const result = await entity.list(db);

    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toContain("SELECT * FROM widgets");
    expect(sql).toContain("ORDER BY name ASC");
    expect(result).toEqual([sampleWidget]);
  });

  it("returns cached results on second call", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleWidget],
      meta: { changes: 0, duration: 1 },
    });

    await entity.list(db);
    await entity.list(db);

    expect(db.query).toHaveBeenCalledOnce();
  });

  it("re-fetches after invalidateCache", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleWidget],
      meta: { changes: 0, duration: 1 },
    });

    await entity.list(db);
    entity.invalidateCache();
    await entity.list(db);

    expect(db.query).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// getBySlug
// ---------------------------------------------------------------------------

describe("taxonomy factory — getBySlug", () => {
  let db: Db;
  let entity: ReturnType<typeof makeEntity>;

  beforeEach(() => {
    db = createMockDb();
    entity = makeEntity();
  });

  it("queries with correct WHERE clause", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleWidget);

    const result = await entity.getBySlug(db, "gear");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("SELECT * FROM widgets WHERE slug = ?");
    expect(params).toEqual(["gear"]);
    expect(result).toEqual(sampleWidget);
  });

  it("returns null when not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    expect(await entity.getBySlug(db, "nope")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------

describe("taxonomy factory — getById", () => {
  let db: Db;
  let entity: ReturnType<typeof makeEntity>;

  beforeEach(() => {
    db = createMockDb();
    entity = makeEntity();
  });

  it("queries with correct WHERE clause", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleWidget);

    const result = await entity.getById(db, "w-1");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("SELECT * FROM widgets WHERE id = ?");
    expect(params).toEqual(["w-1"]);
    expect(result).toEqual(sampleWidget);
  });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("taxonomy factory — create", () => {
  let db: Db;
  let entity: ReturnType<typeof makeEntity>;

  beforeEach(() => {
    db = createMockDb();
    entity = makeEntity();
  });

  it("inserts with correct columns and params", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleWidget);

    const result = await entity.create(db, { name: "Gear", slug: "gear" });

    expect(db.execute).toHaveBeenCalledOnce();
    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("INSERT INTO widgets");
    expect(sql).toContain("id, name, slug, created_at, updated_at");
    expect(params![1]).toBe("Gear");
    expect(params![2]).toBe("gear");
    expect(typeof params![0]).toBe("string"); // ULID
    expect(typeof params![3]).toBe("number"); // created_at
    expect(typeof params![4]).toBe("number"); // updated_at
    expect(result).toEqual(sampleWidget);
  });

  it("invalidates cache after creation", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleWidget);
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleWidget],
      meta: { changes: 0, duration: 1 },
    });

    await entity.list(db);
    await entity.create(db, { name: "Gear", slug: "gear" });
    await entity.list(db);

    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it("throws when getById returns null after insert", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    await expect(entity.create(db, { name: "X", slug: "x" })).rejects.toThrow(
      /Failed to retrieve Widget .+ after creation/,
    );
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("taxonomy factory — update", () => {
  let db: Db;
  let entity: ReturnType<typeof makeEntity>;

  beforeEach(() => {
    db = createMockDb();
    entity = makeEntity();
  });

  it("builds SET clause and appends updated_at", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    vi.mocked(db.firstOrNull).mockResolvedValue({ ...sampleWidget, name: "Cog" });

    const result = await entity.update(db, "w-1", { name: "Cog" });

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("UPDATE widgets SET");
    expect(sql).toContain("name = ?");
    expect(sql).toContain("updated_at = ?");
    expect(sql).toContain("WHERE id = ?");
    expect(params).toContain("Cog");
    expect(params![params!.length - 1]).toBe("w-1"); // last param = id
    expect(result?.name).toBe("Cog");
  });

  it("returns existing row without executing when input is empty", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleWidget);

    const result = await entity.update(db, "w-1", {});

    expect(db.execute).not.toHaveBeenCalled();
    expect(result).toEqual(sampleWidget);
  });

  it("invalidates cache after update", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleWidget);
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleWidget],
      meta: { changes: 0, duration: 1 },
    });

    await entity.list(db);
    await entity.update(db, "w-1", { name: "Updated" });
    await entity.list(db);

    expect(db.query).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------

describe("taxonomy factory — delete", () => {
  let db: Db;
  let entity: ReturnType<typeof makeEntity>;

  beforeEach(() => {
    db = createMockDb();
    entity = makeEntity();
  });

  it("deletes with correct table and returns true", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    const result = await entity.delete(db, "w-1");

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("DELETE FROM widgets WHERE id = ?");
    expect(params).toEqual(["w-1"]);
    expect(result).toBe(true);
  });

  it("returns false when row not found", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 1 });
    expect(await entity.delete(db, "nope")).toBe(false);
  });

  it("invalidates cache after deletion", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleWidget],
      meta: { changes: 0, duration: 1 },
    });

    await entity.list(db);
    await entity.delete(db, "w-1");
    await entity.list(db);

    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it("does not invalidate cache when row not found", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 1 });
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleWidget],
      meta: { changes: 0, duration: 1 },
    });

    await entity.list(db);
    await entity.delete(db, "nope");
    await entity.list(db);

    expect(db.query).toHaveBeenCalledOnce();
  });
});
