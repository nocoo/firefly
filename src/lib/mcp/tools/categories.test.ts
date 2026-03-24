import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import type { Category } from "@/models/types";
import {
  handleListCategories,
  handleGetCategory,
  handleCreateCategory,
  handleUpdateCategory,
  handleDeleteCategory,
  type ToolContext,
} from "./categories";

// ---------------------------------------------------------------------------
// Mock data layer
// ---------------------------------------------------------------------------

vi.mock("@/data/categories", () => ({
  listCategories: vi.fn(),
  getCategoryBySlug: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

import {
  listCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/data/categories";

function createMockDb(): Db {
  return {
    query: vi.fn(),
    firstOrNull: vi.fn(),
    execute: vi.fn(),
    batch: vi.fn(),
  };
}

const now = Math.floor(Date.now() / 1000);

const sampleCategory: Category = {
  id: "cat-1",
  name: "Tech",
  slug: "tech",
  description: "Technology posts",
  sort_order: 0,
  post_count: 5,
  created_at: now,
  updated_at: now,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleListCategories", () => {
  let ctx: ToolContext;
  beforeEach(() => {
    ctx = { db: createMockDb() };
    vi.mocked(listCategories).mockReset();
  });

  it("returns all categories", async () => {
    vi.mocked(listCategories).mockResolvedValue([sampleCategory]);

    const result = await handleListCategories(ctx);

    expect(listCategories).toHaveBeenCalledWith(ctx.db);
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Tech");
  });
});

describe("handleGetCategory", () => {
  let ctx: ToolContext;
  beforeEach(() => {
    ctx = { db: createMockDb() };
    vi.mocked(getCategoryBySlug).mockReset();
  });

  it("returns category when found", async () => {
    vi.mocked(getCategoryBySlug).mockResolvedValue(sampleCategory);

    const result = await handleGetCategory(ctx, { slug: "tech" });

    const data = JSON.parse(result.content[0].text);
    expect(data.name).toBe("Tech");
  });

  it("returns error for missing category", async () => {
    vi.mocked(getCategoryBySlug).mockResolvedValue(null);

    const result = await handleGetCategory(ctx, { slug: "missing" });
    expect(result.isError).toBe(true);
  });
});

describe("handleCreateCategory", () => {
  let ctx: ToolContext;
  beforeEach(() => {
    ctx = { db: createMockDb() };
    vi.mocked(createCategory).mockReset();
  });

  it("creates category and returns it", async () => {
    vi.mocked(createCategory).mockResolvedValue(sampleCategory);

    const result = await handleCreateCategory(ctx, {
      name: "Tech",
      slug: "tech",
      description: "Technology posts",
    });

    expect(createCategory).toHaveBeenCalledWith(ctx.db, {
      name: "Tech",
      slug: "tech",
      description: "Technology posts",
      sort_order: undefined,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.name).toBe("Tech");
  });
});

describe("handleUpdateCategory", () => {
  let ctx: ToolContext;
  beforeEach(() => {
    ctx = { db: createMockDb() };
    vi.mocked(getCategoryBySlug).mockReset();
    vi.mocked(updateCategory).mockReset();
  });

  it("updates existing category", async () => {
    vi.mocked(getCategoryBySlug).mockResolvedValue(sampleCategory);
    vi.mocked(updateCategory).mockResolvedValue({ ...sampleCategory, name: "Technology" });

    const result = await handleUpdateCategory(ctx, {
      slug: "tech",
      name: "Technology",
    });

    expect(updateCategory).toHaveBeenCalledWith(ctx.db, "cat-1", {
      name: "Technology",
      slug: undefined,
      description: undefined,
      sort_order: undefined,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.name).toBe("Technology");
  });

  it("returns error for missing category", async () => {
    vi.mocked(getCategoryBySlug).mockResolvedValue(null);

    const result = await handleUpdateCategory(ctx, { slug: "missing" });
    expect(result.isError).toBe(true);
  });
});

describe("handleDeleteCategory", () => {
  let ctx: ToolContext;
  beforeEach(() => {
    ctx = { db: createMockDb() };
    vi.mocked(getCategoryBySlug).mockReset();
    vi.mocked(deleteCategory).mockReset();
  });

  it("deletes existing category", async () => {
    vi.mocked(getCategoryBySlug).mockResolvedValue(sampleCategory);
    vi.mocked(deleteCategory).mockResolvedValue(true);

    const result = await handleDeleteCategory(ctx, { slug: "tech" });

    expect(deleteCategory).toHaveBeenCalledWith(ctx.db, "cat-1");
    const data = JSON.parse(result.content[0].text);
    expect(data.deleted).toBe(true);
  });

  it("returns error for missing category", async () => {
    vi.mocked(getCategoryBySlug).mockResolvedValue(null);

    const result = await handleDeleteCategory(ctx, { slug: "missing" });
    expect(result.isError).toBe(true);
  });
});
