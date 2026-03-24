import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import type { Tag } from "@/models/types";
import {
  handleListTags,
  handleGetTag,
  handleCreateTag,
  handleUpdateTag,
  handleDeleteTag,
  type ToolContext,
} from "./tags";

// ---------------------------------------------------------------------------
// Mock data layer
// ---------------------------------------------------------------------------

vi.mock("@/data/tags", () => ({
  listTags: vi.fn(),
  getTagBySlug: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}));

import {
  listTags,
  getTagBySlug,
  createTag,
  updateTag,
  deleteTag,
} from "@/data/tags";

function createMockDb(): Db {
  return {
    query: vi.fn(),
    firstOrNull: vi.fn(),
    execute: vi.fn(),
    batch: vi.fn(),
  };
}

const now = Math.floor(Date.now() / 1000);

const sampleTag: Tag = {
  id: "tag-1",
  name: "TypeScript",
  slug: "typescript",
  post_count: 10,
  created_at: now,
  updated_at: now,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleListTags", () => {
  let ctx: ToolContext;
  beforeEach(() => {
    ctx = { db: createMockDb() };
    vi.mocked(listTags).mockReset();
  });

  it("returns all tags", async () => {
    vi.mocked(listTags).mockResolvedValue([sampleTag]);

    const result = await handleListTags(ctx);

    expect(listTags).toHaveBeenCalledWith(ctx.db);
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("TypeScript");
  });
});

describe("handleGetTag", () => {
  let ctx: ToolContext;
  beforeEach(() => {
    ctx = { db: createMockDb() };
    vi.mocked(getTagBySlug).mockReset();
  });

  it("returns tag when found", async () => {
    vi.mocked(getTagBySlug).mockResolvedValue(sampleTag);

    const result = await handleGetTag(ctx, { slug: "typescript" });

    const data = JSON.parse(result.content[0].text);
    expect(data.name).toBe("TypeScript");
  });

  it("returns error for missing tag", async () => {
    vi.mocked(getTagBySlug).mockResolvedValue(null);

    const result = await handleGetTag(ctx, { slug: "missing" });
    expect(result.isError).toBe(true);
  });
});

describe("handleCreateTag", () => {
  let ctx: ToolContext;
  beforeEach(() => {
    ctx = { db: createMockDb() };
    vi.mocked(createTag).mockReset();
  });

  it("creates tag and returns it", async () => {
    vi.mocked(createTag).mockResolvedValue(sampleTag);

    const result = await handleCreateTag(ctx, {
      name: "TypeScript",
      slug: "typescript",
    });

    expect(createTag).toHaveBeenCalledWith(ctx.db, {
      name: "TypeScript",
      slug: "typescript",
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.name).toBe("TypeScript");
  });
});

describe("handleUpdateTag", () => {
  let ctx: ToolContext;
  beforeEach(() => {
    ctx = { db: createMockDb() };
    vi.mocked(getTagBySlug).mockReset();
    vi.mocked(updateTag).mockReset();
  });

  it("updates existing tag", async () => {
    vi.mocked(getTagBySlug).mockResolvedValue(sampleTag);
    vi.mocked(updateTag).mockResolvedValue({ ...sampleTag, name: "TS" });

    const result = await handleUpdateTag(ctx, {
      slug: "typescript",
      name: "TS",
    });

    expect(updateTag).toHaveBeenCalledWith(ctx.db, "tag-1", {
      name: "TS",
      slug: undefined,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.name).toBe("TS");
  });

  it("returns error for missing tag", async () => {
    vi.mocked(getTagBySlug).mockResolvedValue(null);

    const result = await handleUpdateTag(ctx, { slug: "missing" });
    expect(result.isError).toBe(true);
  });
});

describe("handleDeleteTag", () => {
  let ctx: ToolContext;
  beforeEach(() => {
    ctx = { db: createMockDb() };
    vi.mocked(getTagBySlug).mockReset();
    vi.mocked(deleteTag).mockReset();
  });

  it("deletes existing tag", async () => {
    vi.mocked(getTagBySlug).mockResolvedValue(sampleTag);
    vi.mocked(deleteTag).mockResolvedValue(true);

    const result = await handleDeleteTag(ctx, { slug: "typescript" });

    expect(deleteTag).toHaveBeenCalledWith(ctx.db, "tag-1");
    const data = JSON.parse(result.content[0].text);
    expect(data.deleted).toBe(true);
  });

  it("returns error for missing tag", async () => {
    vi.mocked(getTagBySlug).mockResolvedValue(null);

    const result = await handleDeleteTag(ctx, { slug: "missing" });
    expect(result.isError).toBe(true);
  });
});
