// ---------------------------------------------------------------------------
// Generic CRUD Handler Factory — Unit Tests
// Uses mock EntityConfig with no domain dependencies.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCrudHandlers } from "./handlers";
import { createMockContext, parseToolResult, expectError } from "./test-utils";
import type { Db } from "@/lib/db";
import type { DataLayer, EntityConfig, ToolContext } from "./types";

// ---------------------------------------------------------------------------
// Mock entity setup
// ---------------------------------------------------------------------------

interface MockEntity {
  id: string;
  name: string;
  slug: string;
  heavy_field: string;
}

const entity1: MockEntity = {
  id: "e-1",
  name: "Alpha",
  slug: "alpha",
  heavy_field: "lots of data",
};
const entity2: MockEntity = {
  id: "e-2",
  name: "Beta",
  slug: "beta",
  heavy_field: "more data",
};

type MockDataLayer = {
  [K in keyof DataLayer<MockEntity>]: ReturnType<typeof vi.fn> &
    DataLayer<MockEntity>[K];
};

function createMockDataLayer(): MockDataLayer {
  return {
    list: vi.fn(async (_db: Db) => [entity1, entity2]),
    getById: vi.fn(async (_db: Db, id: string) =>
      [entity1, entity2].find((e) => e.id === id) ?? null,
    ),
    getBySlug: vi.fn(async (_db: Db, slug: string) =>
      [entity1, entity2].find((e) => e.slug === slug) ?? null,
    ),
    create: vi.fn(async (_db: Db, _input: unknown) => entity1),
    update: vi.fn(
      async (_db: Db, _id: string, _input: unknown) =>
        ({ ...entity1, name: "Updated" }) as MockEntity | null,
    ),
    delete: vi.fn(async (_db: Db, _id: string) => true),
  } as MockDataLayer;
}

function createMockConfig(
  overrides?: Partial<EntityConfig<MockEntity>>,
): EntityConfig<MockEntity> {
  return {
    name: "mock",
    display: "Mock",
    dataLayer: createMockDataLayer(),
    schemas: {
      create: {},
      update: {},
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleList", () => {
  it("returns simple array from data layer", async () => {
    const config = createMockConfig();
    const { handleList } = createCrudHandlers(config);
    const ctx = createMockContext();

    const result = await handleList(ctx, {});
    const data = parseToolResult(result) as MockEntity[];
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe("Alpha");
  });

  it("returns paginated result with plural key", async () => {
    const config = createMockConfig({
      dataLayer: {
        ...createMockDataLayer(),
        list: vi.fn().mockResolvedValue({ items: [entity1], total: 10 }),
      },
    });
    const { handleList } = createCrudHandlers(config);
    const ctx = createMockContext();

    const result = await handleList(ctx, {});
    const data = parseToolResult(result) as { mocks: MockEntity[]; total: number };
    expect(data.mocks).toHaveLength(1);
    expect(data.total).toBe(10);
  });

  it("uses custom plural name", async () => {
    const config = createMockConfig({
      plural: "mockEntities",
      dataLayer: {
        ...createMockDataLayer(),
        list: vi.fn().mockResolvedValue({ items: [entity1], total: 1 }),
      },
    });
    const { handleList } = createCrudHandlers(config);
    const ctx = createMockContext();

    const result = await handleList(ctx, {});
    const data = parseToolResult(result) as Record<string, unknown>;
    expect(data).toHaveProperty("mockEntities");
  });

  it("applies projection to list items (simple array)", async () => {
    const config = createMockConfig({
      projection: {
        omit: ["heavy_field"],
        groups: { heavy: ["heavy_field"] },
      },
    });
    const { handleList } = createCrudHandlers(config);
    const ctx = createMockContext();

    const result = await handleList(ctx, {});
    const data = parseToolResult(result) as Record<string, unknown>[];
    expect(data[0]).not.toHaveProperty("heavy_field");
    expect(data[0]).toHaveProperty("name");
  });

  it("applies projection to paginated items", async () => {
    const config = createMockConfig({
      projection: {
        omit: ["heavy_field"],
        groups: { heavy: ["heavy_field"] },
      },
      dataLayer: {
        ...createMockDataLayer(),
        list: vi.fn().mockResolvedValue({ items: [entity1], total: 1 }),
      },
    });
    const { handleList } = createCrudHandlers(config);
    const ctx = createMockContext();

    const result = await handleList(ctx, {});
    const data = parseToolResult(result) as { mocks: Record<string, unknown>[] };
    expect(data.mocks[0]).not.toHaveProperty("heavy_field");
  });

  it("restores projected fields when include group is specified", async () => {
    const config = createMockConfig({
      projection: {
        omit: ["heavy_field"],
        groups: { heavy: ["heavy_field"] },
      },
    });
    const { handleList } = createCrudHandlers(config);
    const ctx = createMockContext();

    const result = await handleList(ctx, { include: ["heavy"] });
    const data = parseToolResult(result) as Record<string, unknown>[];
    expect(data[0]).toHaveProperty("heavy_field", "lots of data");
  });
});

// ---------------------------------------------------------------------------

describe("handleGet", () => {
  it("resolves entity by id", async () => {
    const config = createMockConfig();
    const { handleGet } = createCrudHandlers(config);
    const ctx = createMockContext();

    const result = await handleGet(ctx, { id: "e-1" });
    const data = parseToolResult(result) as MockEntity;
    expect(data.name).toBe("Alpha");
  });

  it("resolves entity by slug", async () => {
    const config = createMockConfig();
    const { handleGet } = createCrudHandlers(config);
    const ctx = createMockContext();

    const result = await handleGet(ctx, { slug: "beta" });
    const data = parseToolResult(result) as MockEntity;
    expect(data.name).toBe("Beta");
  });

  it("returns error for not-found with display name", async () => {
    const config = createMockConfig();
    const { handleGet } = createCrudHandlers(config);
    const ctx = createMockContext();

    const result = await handleGet(ctx, { id: "missing" });
    expectError(result, "Mock not found: missing");
  });

  it("returns error when both id and slug provided", async () => {
    const config = createMockConfig();
    const { handleGet } = createCrudHandlers(config);
    const ctx = createMockContext();

    const result = await handleGet(ctx, { id: "e-1", slug: "alpha" });
    expectError(result, "Provide either id or slug, not both");
  });

  it("returns error when neither id nor slug provided", async () => {
    const config = createMockConfig();
    const { handleGet } = createCrudHandlers(config);
    const ctx = createMockContext();

    const result = await handleGet(ctx, {});
    expectError(result, "Either id or slug is required");
  });

  it("applies afterGet hook", async () => {
    const config = createMockConfig({
      hooks: {
        afterGet: async (_ctx, entity) => ({
          ...entity,
          extra: "enriched",
        }),
      },
    });
    const { handleGet } = createCrudHandlers(config);
    const ctx = createMockContext();

    const result = await handleGet(ctx, { id: "e-1" });
    const data = parseToolResult(result) as MockEntity & { extra: string };
    expect(data.extra).toBe("enriched");
  });
});

// ---------------------------------------------------------------------------

describe("handleCreate", () => {
  it("creates entity and returns it", async () => {
    const config = createMockConfig();
    const { handleCreate } = createCrudHandlers(config);
    const ctx = createMockContext();

    const result = await handleCreate(ctx, { name: "New", slug: "new" });
    const data = parseToolResult(result) as MockEntity;
    expect(data.name).toBe("Alpha"); // mock returns entity1
    expect(config.dataLayer.create).toHaveBeenCalledWith(ctx.db, {
      name: "New",
      slug: "new",
    });
  });

  it("applies mapCreateInput hook", async () => {
    const config = createMockConfig({
      hooks: {
        mapCreateInput: (args) => {
          const { extra: _extra, ...rest } = args;
          return rest;
        },
      },
    });
    const { handleCreate } = createCrudHandlers(config);
    const ctx = createMockContext();

    await handleCreate(ctx, { name: "New", slug: "new", extra: "removed" });
    expect(config.dataLayer.create).toHaveBeenCalledWith(ctx.db, {
      name: "New",
      slug: "new",
    });
  });

  it("calls afterCreate hook after creation", async () => {
    const afterCreate = vi.fn();
    const config = createMockConfig({ hooks: { afterCreate } });
    const { handleCreate } = createCrudHandlers(config);
    const ctx = createMockContext();

    await handleCreate(ctx, { name: "New" });
    expect(afterCreate).toHaveBeenCalledWith(ctx, entity1, { name: "New" });
  });

  it("returns success even when afterCreate fails (best-effort)", async () => {
    const config = createMockConfig({
      hooks: {
        afterCreate: async () => {
          throw new Error("hook failed");
        },
      },
    });
    const { handleCreate } = createCrudHandlers(config);
    const ctx = createMockContext();

    const result = await handleCreate(ctx, { name: "New" });
    // afterCreate is best-effort — failure is logged, entity still returned
    const data = parseToolResult(result) as MockEntity;
    expect(data.id).toBe("e-1");
  });
});

// ---------------------------------------------------------------------------

describe("handleUpdate", () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it("updates entity by id", async () => {
    const config = createMockConfig();
    const { handleUpdate } = createCrudHandlers(config);

    const result = await handleUpdate(ctx, { id: "e-1", name: "Updated" });
    const data = parseToolResult(result) as MockEntity;
    expect(data.name).toBe("Updated");
    expect(config.dataLayer.update).toHaveBeenCalledWith(ctx.db, "e-1", {
      name: "Updated",
    });
  });

  it("updates entity by slug", async () => {
    const config = createMockConfig();
    const { handleUpdate } = createCrudHandlers(config);

    const result = await handleUpdate(ctx, { slug: "alpha", name: "Changed" });
    expect(result.isError).toBeUndefined();
    expect(config.dataLayer.update).toHaveBeenCalledWith(ctx.db, "e-1", {
      name: "Changed",
    });
  });

  it("strips id and slug from business fields", async () => {
    const config = createMockConfig();
    const { handleUpdate } = createCrudHandlers(config);

    await handleUpdate(ctx, { id: "e-1", name: "Changed" });
    // id should NOT be in the update payload
    expect(config.dataLayer.update).toHaveBeenCalledWith(ctx.db, "e-1", {
      name: "Changed",
    });
  });

  it("applies mapUpdateInput hook to business fields", async () => {
    const config = createMockConfig({
      hooks: {
        mapUpdateInput: (args) => {
          const { new_slug, ...rest } = args;
          return { ...rest, slug: new_slug };
        },
      },
    });
    const { handleUpdate } = createCrudHandlers(config);

    await handleUpdate(ctx, { slug: "alpha", new_slug: "alpha-v2", name: "X" });
    expect(config.dataLayer.update).toHaveBeenCalledWith(ctx.db, "e-1", {
      slug: "alpha-v2",
      name: "X",
    });
  });

  it("calls afterUpdate hook with post-update entity", async () => {
    const afterUpdate = vi.fn();
    const config = createMockConfig({ hooks: { afterUpdate } });
    const { handleUpdate } = createCrudHandlers(config);

    await handleUpdate(ctx, { id: "e-1", name: "Updated" });
    expect(afterUpdate).toHaveBeenCalledWith(
      ctx,
      { ...entity1, name: "Updated" },
      { name: "Updated" },
    );
  });

  it("returns error when dataLayer.update returns null", async () => {
    const config = createMockConfig({
      dataLayer: {
        ...createMockDataLayer(),
        update: vi.fn().mockResolvedValue(null),
      },
    });
    const { handleUpdate } = createCrudHandlers(config);

    const result = await handleUpdate(ctx, { id: "e-1", name: "Updated" });
    expectError(result, "Mock not found: e-1");
  });

  it("does not call afterUpdate when dataLayer.update returns null", async () => {
    const afterUpdate = vi.fn();
    const config = createMockConfig({
      hooks: { afterUpdate },
      dataLayer: {
        ...createMockDataLayer(),
        update: vi.fn().mockResolvedValue(null),
      },
    });
    const { handleUpdate } = createCrudHandlers(config);

    await handleUpdate(ctx, { id: "e-1", name: "Updated" });
    expect(afterUpdate).not.toHaveBeenCalled();
  });

  it("returns success even when afterUpdate fails (best-effort)", async () => {
    const config = createMockConfig({
      hooks: {
        afterUpdate: async () => {
          throw new Error("hook failed");
        },
      },
    });
    const { handleUpdate } = createCrudHandlers(config);

    const result = await handleUpdate(ctx, { id: "e-1", name: "Updated" });
    // afterUpdate is best-effort — failure is logged, update still returned
    const data = parseToolResult(result) as MockEntity;
    expect(data.name).toBe("Updated");
  });

  it("returns error when entity not found", async () => {
    const config = createMockConfig();
    const { handleUpdate } = createCrudHandlers(config);

    const result = await handleUpdate(ctx, { id: "missing", name: "X" });
    expectError(result, "Mock not found: missing");
  });
});

// ---------------------------------------------------------------------------

describe("handleDelete", () => {
  it("deletes entity by id", async () => {
    const config = createMockConfig();
    const { handleDelete } = createCrudHandlers(config);
    const ctx = createMockContext();

    const result = await handleDelete(ctx, { id: "e-1" });
    const data = parseToolResult(result) as { deleted: boolean };
    expect(data.deleted).toBe(true);
    expect(config.dataLayer.delete).toHaveBeenCalledWith(ctx.db, "e-1", expect.anything());
  });

  it("deletes entity by slug", async () => {
    const config = createMockConfig();
    const { handleDelete } = createCrudHandlers(config);
    const ctx = createMockContext();

    const result = await handleDelete(ctx, { slug: "alpha" });
    const data = parseToolResult(result) as { deleted: boolean };
    expect(data.deleted).toBe(true);
  });

  it("returns error when entity not found", async () => {
    const config = createMockConfig();
    const { handleDelete } = createCrudHandlers(config);
    const ctx = createMockContext();

    const result = await handleDelete(ctx, { slug: "missing" });
    expectError(result, "Mock not found: missing");
  });

  it("returns error when both id and slug provided", async () => {
    const config = createMockConfig();
    const { handleDelete } = createCrudHandlers(config);
    const ctx = createMockContext();

    const result = await handleDelete(ctx, { id: "e-1", slug: "alpha" });
    expectError(result, "Provide either id or slug, not both");
  });
});
