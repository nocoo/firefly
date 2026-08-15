import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import {
  createHuman,
  getHumanBySlug,
  getHumanByEmail,
  listHumans,
  updateHuman,
  updateHumanAvatarVersion,
  deleteHuman,
  getHumanPostCount,
  normalizeHumanEmail,
} from "./human";
import type { Human, HumanWithMeta } from "@/models/types";

const now = Math.floor(Date.now() / 1000);

const sampleHuman: Human = {
  id: "human-1",
  name: "Li Zheng",
  slug: "li-zheng",
  description: null,
  email: "li@example.com",
  profile_public: 0,
  avatar_version: null,
  created_at: now,
  updated_at: now,
};

describe("normalizeHumanEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeHumanEmail("  A@Example.COM ")).toBe("a@example.com");
  });

  it("maps empty and whitespace to null", () => {
    expect(normalizeHumanEmail("")).toBeNull();
    expect(normalizeHumanEmail("   ")).toBeNull();
    expect(normalizeHumanEmail(null)).toBeNull();
  });
});

describe("createHuman", () => {
  let db: Db;
  beforeEach(() => {
    db = createMockDb();
  });

  it("inserts normalized email and returns the row", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleHuman);

    const result = await createHuman(db, {
      name: "Li Zheng",
      slug: "li-zheng",
      email: "  LI@Example.COM ",
    });

    expect(result.name).toBe("Li Zheng");
    const [sql, params] = vi.mocked(db.execute).mock.calls[0];
    expect(sql).toContain("INSERT INTO humans");
    expect(params).toContain("li@example.com");
    expect(params).toContain(0);
  });
});

describe("listHumans", () => {
  it("joins default flag and post count", async () => {
    const db = createMockDb();
    const row: HumanWithMeta = { ...sampleHuman, post_count: 2, is_default: 1 };
    vi.mocked(db.query).mockResolvedValue({
      results: [row],
      meta: { changes: 0, duration: 1 },
    });

    const result = await listHumans(db);
    expect(result[0].is_default).toBe(1);
    expect(vi.mocked(db.query).mock.calls[0][0]).toContain("default_human_id");
  });
});

describe("updateHuman", () => {
  it("normalizes email on update", async () => {
    const db = createMockDb();
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    vi.mocked(db.firstOrNull).mockResolvedValue({
      ...sampleHuman,
      email: "b@example.com",
    });

    await updateHuman(db, "human-1", { email: " B@Example.COM " });
    const params = vi.mocked(db.execute).mock.calls[0][1] as unknown[];
    expect(params[0]).toBe("b@example.com");
  });
});

describe("updateHumanAvatarVersion", () => {
  it("writes avatar_version", async () => {
    const db = createMockDb();
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    await updateHumanAvatarVersion(db, "human-1", "v2");
    expect(vi.mocked(db.execute).mock.calls[0][0]).toContain("avatar_version");
  });
});

describe("getHumanBySlug", () => {
  it("queries by slug", async () => {
    const db = createMockDb();
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleHuman);
    await getHumanBySlug(db, "li-zheng");
    expect(vi.mocked(db.firstOrNull).mock.calls[0][0]).toContain("slug = ?");
  });
});

describe("getHumanByEmail", () => {
  it("normalizes before lookup", async () => {
    const db = createMockDb();
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleHuman);
    await getHumanByEmail(db, "  LI@Example.COM ");
    const [sql, params] = vi.mocked(db.firstOrNull).mock.calls[0];
    expect(sql).toContain("email = ?");
    expect(params).toEqual(["li@example.com"]);
  });

  it("returns null for empty email without querying", async () => {
    const db = createMockDb();
    expect(await getHumanByEmail(db, "   ")).toBeNull();
    expect(db.firstOrNull).not.toHaveBeenCalled();
  });
});

describe("getHumanPostCount", () => {
  it("counts posts by human_id", async () => {
    const db = createMockDb();
    vi.mocked(db.firstOrNull).mockResolvedValue({ count: 3 });
    expect(await getHumanPostCount(db, "human-1")).toBe(3);
  });
});

describe("deleteHuman", () => {
  it("blocks the last human", async () => {
    const db = createMockDb();
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(sampleHuman)
      .mockResolvedValueOnce({ count: 1 });
    const result = await deleteHuman(db, "human-1");
    expect(result).toEqual({ success: false, reason: "last_human" });
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("blocks the default human", async () => {
    const db = createMockDb();
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(sampleHuman)
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ default_human_id: "human-1" });
    const result = await deleteHuman(db, "human-1");
    expect(result.reason).toBe("is_default");
  });

  it("blocks humans with posts", async () => {
    const db = createMockDb();
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(sampleHuman)
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ default_human_id: "human-2" })
      .mockResolvedValueOnce({ count: 4 });
    const result = await deleteHuman(db, "human-1");
    expect(result).toEqual({
      success: false,
      reason: "has_posts",
      postCount: 4,
    });
  });

  it("deletes when allowed", async () => {
    const db = createMockDb();
    vi.mocked(db.firstOrNull)
      .mockResolvedValueOnce(sampleHuman)
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ default_human_id: "human-2" })
      .mockResolvedValueOnce({ count: 0 });
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 1 });
    const result = await deleteHuman(db, "human-1");
    expect(result.success).toBe(true);
  });
});
