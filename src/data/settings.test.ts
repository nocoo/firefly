import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import {
  getSiteSettings,
  updateSiteSettings,
  updateSiteLogoVersion,
  invalidateSettingsCache,
  _testHelpers,
} from "./settings";

const { parseRow, parseSocialLinks, DEFAULTS } = _testHelpers;

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------


const sampleRow = {
  id: 1,
  posts_per_page: 10,
  comments_enabled: 0,
  font_style: "pingfang",
  site_logo_version: null as string | null,
  site_name: "My Blog",
  site_tagline: "",
  site_description: "",
  site_author: "",
  author_email: "",
  twitter_handle: "",
  social_links: "[]",
  updated_at: 1700000000,
};

// ---------------------------------------------------------------------------
// parseRow
// ---------------------------------------------------------------------------

describe("parseRow", () => {
  it("parses a default row", () => {
    expect(parseRow(sampleRow)).toEqual({
      postsPerPage: 10,
      commentsEnabled: false,
      fontStyle: "pingfang",
      siteLogoVersion: null,
      siteName: "My Blog",
      siteTagline: "",
      siteDescription: "",
      siteAuthor: "",
      authorEmail: "",
      twitterHandle: "",
      socialLinks: [],
      updatedAt: 1700000000,
    });
  });

  it("parses comments enabled", () => {
    expect(
      parseRow({ ...sampleRow, comments_enabled: 1 }),
    ).toEqual({
      postsPerPage: 10,
      commentsEnabled: true,
      fontStyle: "pingfang",
      siteLogoVersion: null,
      siteName: "My Blog",
      siteTagline: "",
      siteDescription: "",
      siteAuthor: "",
      authorEmail: "",
      twitterHandle: "",
      socialLinks: [],
      updatedAt: 1700000000,
    });
  });

  it("clamps invalid posts_per_page to default", () => {
    expect(parseRow({ ...sampleRow, posts_per_page: 0 }).postsPerPage).toBe(10);
    expect(parseRow({ ...sampleRow, posts_per_page: -5 }).postsPerPage).toBe(10);
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

  it("parses site_logo_version when set", () => {
    expect(parseRow({ ...sampleRow, site_logo_version: "a1b2c3d4" }).siteLogoVersion).toBe("a1b2c3d4");
  });

  it("parses site_logo_version as null when absent", () => {
    expect(parseRow({ ...sampleRow, site_logo_version: null }).siteLogoVersion).toBeNull();
  });

  it("parses site identity fields", () => {
    const row = {
      ...sampleRow,
      site_name: "LIZHENG.ME",
      site_tagline: "知白守黑",
      site_description: "A personal blog",
      site_author: "Li Zheng",
      author_email: "test@example.com",
      twitter_handle: "@test",
    };
    const result = parseRow(row);
    expect(result.siteName).toBe("LIZHENG.ME");
    expect(result.siteTagline).toBe("知白守黑");
    expect(result.siteDescription).toBe("A personal blog");
    expect(result.siteAuthor).toBe("Li Zheng");
    expect(result.authorEmail).toBe("test@example.com");
    expect(result.twitterHandle).toBe("@test");
  });

  it("falls back to 'My Blog' for empty site_name", () => {
    expect(parseRow({ ...sampleRow, site_name: "" }).siteName).toBe("My Blog");
  });

  it("falls back to empty string when site_tagline is null/undefined", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseRow({ ...sampleRow, site_tagline: null as any }).siteTagline).toBe("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseRow({ ...sampleRow, site_tagline: undefined as any }).siteTagline).toBe("");
  });

  it("falls back to empty string when site_description is null/undefined", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseRow({ ...sampleRow, site_description: null as any }).siteDescription).toBe("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseRow({ ...sampleRow, site_description: undefined as any }).siteDescription).toBe("");
  });

  it("falls back to empty string when site_author is null/undefined", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseRow({ ...sampleRow, site_author: null as any }).siteAuthor).toBe("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseRow({ ...sampleRow, site_author: undefined as any }).siteAuthor).toBe("");
  });

  it("falls back to empty string when author_email is null/undefined", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseRow({ ...sampleRow, author_email: null as any }).authorEmail).toBe("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseRow({ ...sampleRow, author_email: undefined as any }).authorEmail).toBe("");
  });

  it("falls back to empty string when twitter_handle is null/undefined", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseRow({ ...sampleRow, twitter_handle: null as any }).twitterHandle).toBe("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseRow({ ...sampleRow, twitter_handle: undefined as any }).twitterHandle).toBe("");
  });

  it("parses valid social_links JSON", () => {
    const links = [{ name: "GitHub", url: "https://github.com/test", brand: "github" }];
    const result = parseRow({ ...sampleRow, social_links: JSON.stringify(links) });
    expect(result.socialLinks).toEqual(links);
  });

  it("falls back to empty array for invalid social_links JSON", () => {
    expect(parseRow({ ...sampleRow, social_links: "not json" }).socialLinks).toEqual([]);
  });

  it("filters out invalid entries in social_links array", () => {
    const raw = JSON.stringify([
      { name: "GitHub", url: "https://github.com", brand: "github" },
      { name: 123, url: "bad" },
      "string entry",
      null,
    ]);
    const result = parseRow({ ...sampleRow, social_links: raw });
    expect(result.socialLinks).toEqual([
      { name: "GitHub", url: "https://github.com", brand: "github" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// parseSocialLinks
// ---------------------------------------------------------------------------

describe("parseSocialLinks", () => {
  it("parses valid JSON array", () => {
    const links = [{ name: "X", url: "https://x.com/test", brand: "x" }];
    expect(parseSocialLinks(JSON.stringify(links))).toEqual(links);
  });

  it("returns empty array for non-array JSON", () => {
    expect(parseSocialLinks('{"not":"array"}')).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseSocialLinks("broken")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseSocialLinks("")).toEqual([]);
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
      site_name: "Renamed",
    });
    const result = await getSiteSettings(db);
    expect(result.siteName).toBe("Renamed");
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

  it("updates site identity fields", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 0 });
    vi.mocked(db.firstOrNull).mockResolvedValue({
      ...sampleRow,
      site_name: "Test Blog",
      site_author: "Test Author",
    });

    const result = await updateSiteSettings(db, {
      siteName: "Test Blog",
      siteAuthor: "Test Author",
    });
    expect(result.siteName).toBe("Test Blog");
    expect(result.siteAuthor).toBe("Test Author");

    const sql = vi.mocked(db.execute).mock.calls[0][0] as string;
    expect(sql).toContain("site_name = ?");
    expect(sql).toContain("site_author = ?");
  });

  it("serializes socialLinks as JSON", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 0 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleRow);

    const links = [{ name: "GitHub", url: "https://github.com/test", brand: "github" }];
    await updateSiteSettings(db, { socialLinks: links });

    const params = vi.mocked(db.execute).mock.calls[0][1] as unknown[];
    expect(params).toContain(JSON.stringify(links));
  });

  it("slices siteTagline to 500 characters", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 0 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleRow);

    const longTagline = "a".repeat(600);
    await updateSiteSettings(db, { siteTagline: longTagline });

    const params = vi.mocked(db.execute).mock.calls[0][1] as unknown[];
    expect(params).toContain("a".repeat(500));
  });

  it("slices siteDescription to 1000 characters", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 0 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleRow);

    const longDesc = "b".repeat(1200);
    await updateSiteSettings(db, { siteDescription: longDesc });

    const params = vi.mocked(db.execute).mock.calls[0][1] as unknown[];
    expect(params).toContain("b".repeat(1000));
  });

  it("slices authorEmail to 255 characters", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 0 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleRow);

    const longEmail = "c".repeat(300) + "@example.com";
    await updateSiteSettings(db, { authorEmail: longEmail });

    const params = vi.mocked(db.execute).mock.calls[0][1] as unknown[];
    expect(params).toContain(longEmail.slice(0, 255));
  });

  it("slices twitterHandle to 50 characters", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 0 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleRow);

    const longHandle = "@" + "d".repeat(70);
    await updateSiteSettings(db, { twitterHandle: longHandle });

    const params = vi.mocked(db.execute).mock.calls[0][1] as unknown[];
    expect(params).toContain(longHandle.slice(0, 50));
  });

  it("converts commentsEnabled false to integer 0", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 0 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleRow);

    await updateSiteSettings(db, { commentsEnabled: false });
    expect(vi.mocked(db.execute).mock.calls[0][1]).toContain(0);
  });
});

// ---------------------------------------------------------------------------
// updateSiteLogoVersion
// ---------------------------------------------------------------------------

describe("updateSiteLogoVersion", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
    invalidateSettingsCache();
  });

  it("sets logo version", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 0 });
    vi.mocked(db.firstOrNull).mockResolvedValue({
      ...sampleRow,
      site_logo_version: "a1b2c3d4",
    });

    const result = await updateSiteLogoVersion(db, "a1b2c3d4");
    expect(result.siteLogoVersion).toBe("a1b2c3d4");

    const sql = vi.mocked(db.execute).mock.calls[0][0] as string;
    expect(sql).toContain("site_logo_version = ?");
    expect(sql).toContain("updated_at = unixepoch()");
    expect(vi.mocked(db.execute).mock.calls[0][1]).toEqual(["a1b2c3d4"]);
  });

  it("clears logo version with null", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 0 });
    vi.mocked(db.firstOrNull).mockResolvedValue({
      ...sampleRow,
      site_logo_version: null,
    });

    const result = await updateSiteLogoVersion(db, null);
    expect(result.siteLogoVersion).toBeNull();
    expect(vi.mocked(db.execute).mock.calls[0][1]).toEqual([null]);
  });

  it("invalidates cache after update", async () => {
    vi.mocked(db.execute).mockResolvedValue({ changes: 1, duration: 0 });
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleRow);

    // Prime cache
    await getSiteSettings(db);
    expect(db.firstOrNull).toHaveBeenCalledOnce();

    // Update logo version — should invalidate cache
    await updateSiteLogoVersion(db, "newver01");
    // getSiteSettings is called inside updateSiteLogoVersion, re-fetching from DB
    expect(db.firstOrNull).toHaveBeenCalledTimes(2);
  });
});
