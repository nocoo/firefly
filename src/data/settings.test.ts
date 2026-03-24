import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import {
  getSiteSettings,
  updateSiteSettings,
  invalidateSettingsCache,
  _testHelpers,
} from "./settings";

const { parseRow, DEFAULTS } = _testHelpers;

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

function createMockDb(): Db {
  return {
    query: vi.fn(),
    firstOrNull: vi.fn(),
    execute: vi.fn(),
    batch: vi.fn(),
  };
}

const sampleRow = {
  id: 1,
  locale: "zh",
  posts_per_page: 10,
  comments_enabled: 0,
  font_style: "pingfang",
  updated_at: 1700000000,
};

// ---------------------------------------------------------------------------
// parseRow
// ---------------------------------------------------------------------------

describe("parseRow", () => {
  it("parses a default row", () => {
    expect(parseRow(sampleRow)).toEqual({
      locale: "zh",
      postsPerPage: 10,
      commentsEnabled: false,
      fontStyle: "pingfang",
      updatedAt: 1700000000,
    });
  });

  it("parses en locale and comments enabled", () => {
    expect(
      parseRow({ ...sampleRow, locale: "en", comments_enabled: 1 }),
    ).toEqual({
      locale: "en",
      postsPerPage: 10,
      commentsEnabled: true,
      fontStyle: "pingfang",
      updatedAt: 1700000000,
    });
  });

  it("clamps invalid posts_per_page to default", () => {
    expect(parseRow({ ...sampleRow, posts_per_page: 0 }).postsPerPage).toBe(10);
    expect(parseRow({ ...sampleRow, posts_per_page: -5 }).postsPerPage).toBe(10);
  });

  it("falls back to zh for unknown locale", () => {
    expect(parseRow({ ...sampleRow, locale: "fr" }).locale).toBe("zh");
  });

  it("falls back to pingfang for unknown font_style", () => {
    expect(parseRow({ ...sampleRow, font_style: "unknown" }).fontStyle).toBe("pingfang");
  });

  it("parses valid font_style values", () => {
    expect(parseRow({ ...sampleRow, font_style: "pingfang" }).fontStyle).toBe("pingfang");
    expect(parseRow({ ...sampleRow, font_style: "serif" }).fontStyle).toBe("serif");
    expect(parseRow({ ...sampleRow, font_style: "sans" }).fontStyle).toBe("sans");
    expect(parseRow({ ...sampleRow, font_style: "classic" }).fontStyle).toBe("classic");
  });
});

// ---------------------------------------------------------------------------
// getSiteSettings
// ---------------------------------------------------------------------------

describe("getSiteSettings", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
    invalidateSettingsCache();
  });

  it("fetches from DB on first call", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleRow);

    const result = await getSiteSettings(db);
    expect(result.locale).toBe("zh");
    expect(result.postsPerPage).toBe(10);
    expect(result.commentsEnabled).toBe(false);
    expect(db.firstOrNull).toHaveBeenCalledOnce();
  });

  it("returns cached value on second call", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleRow);

    await getSiteSettings(db);
    await getSiteSettings(db);

    expect(db.firstOrNull).toHaveBeenCalledOnce();
  });

  it("returns defaults when row is null", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);

    const result = await getSiteSettings(db);
    expect(result).toEqual(DEFAULTS);
  });

  it("re-fetches after cache invalidation", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleRow);

    await getSiteSettings(db);
    invalidateSettingsCache();

    vi.mocked(db.firstOrNull).mockResolvedValue({
      ...sampleRow,
      locale: "en",
    });
    const result = await getSiteSettings(db);
    expect(result.locale).toBe("en");
    expect(db.firstOrNull).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// updateSiteSettings
// ---------------------------------------------------------------------------

describe("updateSiteSettings", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
    invalidateSettingsCache();
  });

  it("updates locale", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 0 });
    vi.mocked(db.firstOrNull).mockResolvedValue({
      ...sampleRow,
      locale: "en",
    });

    const result = await updateSiteSettings(db, { locale: "en" });
    expect(result.locale).toBe("en");

    const sql = vi.mocked(db.execute).mock.calls[0][0] as string;
    expect(sql).toContain("locale = ?");
    expect(sql).toContain("updated_at = unixepoch()");
  });

  it("clamps postsPerPage to 1-100", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 0 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleRow);

    await updateSiteSettings(db, { postsPerPage: 0 });
    expect(vi.mocked(db.execute).mock.calls[0][1]).toContain(1);

    vi.mocked(db.execute).mockClear();
    await updateSiteSettings(db, { postsPerPage: 200 });
    expect(vi.mocked(db.execute).mock.calls[0][1]).toContain(100);
  });

  it("converts commentsEnabled boolean to integer", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 0 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleRow);

    await updateSiteSettings(db, { commentsEnabled: true });
    expect(vi.mocked(db.execute).mock.calls[0][1]).toContain(1);
  });

  it("does nothing when input is empty", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleRow);

    await updateSiteSettings(db, {});
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("updates fontStyle", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 0 });
    vi.mocked(db.firstOrNull).mockResolvedValue({
      ...sampleRow,
      font_style: "serif",
    });

    const result = await updateSiteSettings(db, { fontStyle: "serif" });
    expect(result.fontStyle).toBe("serif");

    const sql = vi.mocked(db.execute).mock.calls[0][0] as string;
    expect(sql).toContain("font_style = ?");
  });
});
