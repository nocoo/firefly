import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "./test-utils";
import { list, getById, getBySlug, create, update, remove } from "./base-data-layer";
import type { EntityConfig, BaseEntity } from "./types";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

interface TestEntity extends BaseEntity {
  name: string;
  slug: string;
  created_at: number;
  updated_at: number;
}

const sampleEntity: TestEntity = {
  id: "ent-1",
  name: "Test",
  slug: "test",
  created_at: 1000,
  updated_at: 1000,
};

function simpleConfig(): EntityConfig<TestEntity> {
  return {
    table: "test_table",
    displayName: "TestEntity",
    hasUpdatedAt: true,
    hasSlug: true,
    fields: {
      name: { column: "name" },
      slug: { column: "slug" },
    },
    insertColumns: ["name", "slug"],
    defaultOrderBy: "name ASC",
  };
}

// ---------------------------------------------------------------------------
// list — paginated (default)
// ---------------------------------------------------------------------------

describe("list (paginated, default)", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns paginated results with default pagination", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleEntity],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 1 });

    const result = await list(db, simpleConfig()) as { items: TestEntity[]; total: number };

    expect(result.items).toEqual([sampleEntity]);
    expect(result.total).toBe(1);
    const sql = vi.mocked(db.query).mock.calls[0][0] as string;
    expect(sql).toContain("SELECT * FROM test_table");
    expect(sql).toContain("ORDER BY name ASC");
    expect(sql).toContain("LIMIT");
  });

  it("passes page and pageSize from options", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    await list(db, simpleConfig(), { page: 3, pageSize: 10 });

    const params = vi.mocked(db.query).mock.calls[0][1];
    expect(params).toContain(10); // pageSize
    expect(params).toContain(20); // offset = (3-1)*10
  });

  it("uses orderBy from options when allowedOrderColumns is set", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    const config: EntityConfig<TestEntity> = {
      ...simpleConfig(),
      allowedOrderColumns: ["name", "created_at"],
    };

    await list(db, config, { orderBy: "created_at", orderDirection: "DESC" });

    const sql = vi.mocked(db.query).mock.calls[0][0] as string;
    expect(sql).toContain("ORDER BY created_at DESC");
  });

  it("falls back to defaultOrderBy when orderBy not in allowedOrderColumns", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    const config: EntityConfig<TestEntity> = {
      ...simpleConfig(),
      allowedOrderColumns: ["name", "created_at"],
    };

    expect(
      list(db, config, { orderBy: "hacked_column" }),
    ).rejects.toThrow("Invalid order by column");
  });

  it("ignores orderBy when allowedOrderColumns not configured", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 0 });

    await list(db, simpleConfig(), { orderBy: "created_at" });

    const sql = vi.mocked(db.query).mock.calls[0][0] as string;
    expect(sql).toContain("ORDER BY name ASC");
  });
});

// ---------------------------------------------------------------------------
// list — listMode: "all" + orderBy
// ---------------------------------------------------------------------------

describe("list (listMode: all)", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("returns T[] with listMode all", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [sampleEntity],
      meta: { changes: 0, duration: 1 },
    });

    const config: EntityConfig<TestEntity> = {
      ...simpleConfig(),
      listMode: "all",
    };
    const result = await list(db, config);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([sampleEntity]);
  });

  it("respects orderBy in all mode when allowedOrderColumns is set", async () => {
    vi.mocked(db.query).mockResolvedValue({
      results: [],
      meta: { changes: 0, duration: 1 },
    });

    const config: EntityConfig<TestEntity> = {
      ...simpleConfig(),
      listMode: "all",
      allowedOrderColumns: ["name", "created_at"],
    };

    await list(db, config, { orderBy: "created_at", orderDirection: "ASC" });

    const sql = vi.mocked(db.query).mock.calls[0][0] as string;
    expect(sql).toContain("ORDER BY created_at ASC");
  });
});

// ---------------------------------------------------------------------------
// list — customList
// ---------------------------------------------------------------------------

describe("list (customList)", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("delegates to customList when defined", async () => {
    const customResult = { items: [sampleEntity], total: 1 };
    const customList = vi.fn().mockResolvedValue(customResult);

    const config: EntityConfig<TestEntity> = {
      ...simpleConfig(),
      listMode: "paginated",
      customList,
    };

    const result = await list(db, config, { page: 1 });
    expect(customList).toHaveBeenCalledWith(db, { page: 1 });
    expect(result).toEqual(customResult);
  });
});

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------

describe("getById", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("uses SELECT * FROM table for simple config", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleEntity);
    const result = await getById(db, simpleConfig(), "ent-1");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("SELECT * FROM test_table");
    expect(sql).toContain("WHERE id = ?");
    expect(params).toEqual(["ent-1"]);
    expect(result).toEqual(sampleEntity);
  });

  it("uses viewQuery + tableAlias when defined", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleEntity);

    const config: EntityConfig<TestEntity> = {
      ...simpleConfig(),
      viewQuery: "SELECT t.*, x.extra FROM test_table t LEFT JOIN extras x ON x.id = t.id",
      tableAlias: "t",
    };

    await getById(db, config, "ent-1");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("SELECT t.*, x.extra");
    expect(sql).toContain("WHERE t.id = ?");
    expect(params).toEqual(["ent-1"]);
  });

  it("returns null when not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    const result = await getById(db, simpleConfig(), "nonexistent");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getBySlug
// ---------------------------------------------------------------------------

describe("getBySlug", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("queries by slug with SELECT * FROM table", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleEntity);
    const result = await getBySlug(db, simpleConfig(), "test");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("WHERE slug = ?");
    expect(params).toEqual(["test"]);
    expect(result).toEqual(sampleEntity);
  });

  it("uses tableAlias when viewQuery is defined", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleEntity);

    const config: EntityConfig<TestEntity> = {
      ...simpleConfig(),
      viewQuery: "SELECT t.* FROM test_table t",
      tableAlias: "t",
    };

    await getBySlug(db, config, "test");

    const [sql] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("WHERE t.slug = ?");
  });

  it("applies resolveFilter when provided", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleEntity);

    const config: EntityConfig<TestEntity> = {
      ...simpleConfig(),
      viewQuery: "SELECT t.* FROM test_table t",
      tableAlias: "t",
      resolveFilters: {
        published: { clause: "t.status = ?", params: ["published"] },
      },
    };

    await getBySlug(db, config, "test", "published");

    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("t.status = ?");
    expect(params).toEqual(["test", "published"]);
  });

  it("returns null when not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    const result = await getBySlug(db, simpleConfig(), "nonexistent");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("create", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("inserts and returns entity", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    // getById call after insert
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleEntity);

    const result = await create(db, simpleConfig(), { name: "Test", slug: "test" });

    expect(db.execute).toHaveBeenCalledOnce();
    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("INSERT INTO test_table");
    expect(result).toEqual(sampleEntity);
  });

  it("generates id and timestamps in insert params", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleEntity);

    await create(db, simpleConfig(), { name: "Test", slug: "test" });

    const params = vi.mocked(db.execute).mock.calls[0][1]!;
    // params: [name, slug, id, created_at, updated_at]
    expect(params[0]).toBe("Test");
    expect(params[1]).toBe("test");
    expect(typeof params[2]).toBe("string"); // id (ULID)
    expect(typeof params[3]).toBe("number"); // created_at
    expect(typeof params[4]).toBe("number"); // updated_at
  });

  it("calls beforeCreate hook when defined", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleEntity);

    const beforeCreate = vi.fn().mockResolvedValue({
      name: "Hooked",
      slug: "hooked",
    });

    const config: EntityConfig<TestEntity> = {
      ...simpleConfig(),
      hooks: { beforeCreate },
    };

    await create(db, config, { name: "Test", slug: "test" });

    expect(beforeCreate).toHaveBeenCalledOnce();
    const hookInput = beforeCreate.mock.calls[0][1];
    expect(hookInput.name).toBe("Test");
  });

  it("throws when entity not found after insert", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    await expect(
      create(db, simpleConfig(), { name: "Test", slug: "test" }),
    ).rejects.toThrow("Failed to retrieve TestEntity");
  });

  it("does not include updated_at when hasUpdatedAt is false", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleEntity);

    const config: EntityConfig<TestEntity> = {
      ...simpleConfig(),
      hasUpdatedAt: false,
    };

    await create(db, config, { name: "Test", slug: "test" });

    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).not.toContain("updated_at");
    expect(sql).toContain("created_at");
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("update", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("updates specified fields and returns updated entity", async () => {
    // First firstOrNull: fetch existing
    // Second firstOrNull: fetch back after update
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(sampleEntity)
      .mockResolvedValueOnce({ ...sampleEntity, name: "Updated" });
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    const result = await update(db, simpleConfig(), "ent-1", { name: "Updated" });

    expect(db.firstOrNull).toHaveBeenCalledTimes(2);
    expect(db.execute).toHaveBeenCalledOnce();

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("UPDATE test_table SET");
    expect(sql).toContain("name = ?");
    expect(sql).toContain("updated_at = ?");
    expect(params).toContain("Updated");
    expect(result?.name).toBe("Updated");
  });

  it("returns existing entity on no-op update (no fields changed)", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleEntity);

    const result = await update(db, simpleConfig(), "ent-1", {});

    expect(db.execute).not.toHaveBeenCalled();
    expect(result).toEqual(sampleEntity);
  });

  it("returns null when entity not found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    const result = await update(db, simpleConfig(), "nonexistent", { name: "X" });
    expect(result).toBeNull();
  });

  it("calls beforeUpdate hook with existing entity", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleEntity);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    const beforeUpdate = vi.fn().mockResolvedValue({ name: "Hooked" });

    const config: EntityConfig<TestEntity> = {
      ...simpleConfig(),
      hooks: { beforeUpdate },
    };

    await update(db, config, "ent-1", { name: "Updated" });

    expect(beforeUpdate).toHaveBeenCalledOnce();
    expect(beforeUpdate.mock.calls[0][1]).toEqual(sampleEntity);
  });

  it("does not append updated_at when hasUpdatedAt is false", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleEntity);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    const config: EntityConfig<TestEntity> = {
      ...simpleConfig(),
      hasUpdatedAt: false,
    };

    await update(db, config, "ent-1", { name: "Updated" });

    const [sql] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).not.toContain("updated_at");
  });

  it("uses viewQuery for fetch-back after update", async () => {
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(sampleEntity)
      .mockResolvedValueOnce(sampleEntity);
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    const config: EntityConfig<TestEntity> = {
      ...simpleConfig(),
      viewQuery: "SELECT t.* FROM test_table t",
      tableAlias: "t",
    };

    await update(db, config, "ent-1", { name: "Updated" });

    // Both firstOrNull calls should use viewQuery
    const sql1 = vi.mocked(db.firstOrNull).mock.calls[0][0] as string;
    const sql2 = vi.mocked(db.firstOrNull).mock.calls[1][0] as string;
    expect(sql1).toContain("SELECT t.*");
    expect(sql2).toContain("SELECT t.*");

    // But UPDATE uses plain table name
    const updateSql = vi.mocked(db.execute).mock.calls[0][0] as string;
    expect(updateSql).toContain("UPDATE test_table SET");
    expect(updateSql).not.toContain("SELECT");
  });
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

describe("remove", () => {
  let db: Db;
  beforeEach(() => { db = createMockDb(); });

  it("deletes and returns true when row exists", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });

    const result = await remove(db, simpleConfig(), "ent-1");

    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("DELETE FROM test_table WHERE id = ?");
    expect(params).toEqual(["ent-1"]);
    expect(result).toBe(true);
  });

  it("returns false when row does not exist", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 0, duration: 0 });

    const result = await remove(db, simpleConfig(), "nonexistent");
    expect(result).toBe(false);
  });
});
