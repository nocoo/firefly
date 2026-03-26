import { gunzipSync } from "node:zlib";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db, DbQueryResult } from "@/lib/db";
import type { Post, Category, Tag, Comment, Attachment, Redirect } from "@/models/types";
import { BACKUP_SCHEMA_VERSION } from "@/models/backup-schema";
import type { FireflyBackupEnvelope } from "@/models/backup-schema";
import { collectBackupData, serializeBackup, _testHelpers } from "./backup-export";

const {
  convertPost,
  convertCategory,
  convertTag,
  convertComment,
  convertAttachment,
  convertRedirect,
  convertSiteSettings,
  SITE_SETTINGS_SQL,
} = _testHelpers;

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

const samplePost: Post = {
  id: "01HX1234",
  title: "Test Post",
  slug: "test-post",
  content: "# Hello",
  content_html: "<h1>Hello</h1>",
  excerpt: "Hello",
  status: "published",
  category_id: "cat1",
  featured_image: null,
  comment_enabled: 1,
  comment_count: 0,
  view_count: 100,
  reading_time: 3,
  wp_id: null,
  wp_permalink: null,
  reference_url: null,
  reference_title: null,
  reference_description: null,
  reference_image: null,
  published_at: 1774483200,
  created_at: 1774483200,
  updated_at: 1774483200,
};

const sampleCategory: Category = {
  id: "cat1",
  name: "Tech",
  slug: "tech",
  description: "Technology posts",
  sort_order: 0,
  post_count: 1,
  created_at: 1774483200,
  updated_at: 1774483200,
};

const sampleTag: Tag = {
  id: "tag1",
  name: "javascript",
  slug: "javascript",
  post_count: 1,
  created_at: 1774483200,
  updated_at: 1774483200,
};

const sampleComment: Comment = {
  id: "cmt1",
  post_id: "01HX1234",
  parent_id: null,
  author_name: "Test User",
  author_email: "test@example.com",
  author_url: null,
  content: "Nice post!",
  wp_id: null,
  created_at: 1774483200,
};

const sampleAttachment: Attachment = {
  id: "att1",
  filename: "photo.jpg",
  r2_key: "uploads/photo.jpg",
  mime_type: "image/jpeg",
  size: 12345,
  width: 800,
  height: 600,
  alt_text: "A photo",
  wp_id: null,
  created_at: 1774483200,
};

const sampleRedirect: Redirect = {
  id: "rdr1",
  source_path: "/old-path",
  target_path: "/new-path",
  status_code: 301,
  hit_count: 42,
  created_at: 1774483200,
};

const sampleSettingsRow = {
  locale: "zh",
  posts_per_page: 10,
  comments_enabled: 1,
  font_style: "pingfang",
  site_logo_version: null,
  site_name: "Test Blog",
  site_tagline: "A test blog",
  site_description: "Description",
  site_author: "Author",
  author_email: "test@example.com",
  twitter_handle: "@test",
  social_links: "[]",
  ai_provider: "anthropic",
  ai_model: "claude-sonnet-4-20250514",
  ai_base_url: "",
  ai_sdk_type: "",
  updated_at: 1774483200,
};

function mockResult<T>(results: T[]): DbQueryResult<T> {
  return { results, meta: { changes: 0, duration: 1 } };
}

// ---------------------------------------------------------------------------
// Entity converters
// ---------------------------------------------------------------------------

describe("convertPost", () => {
  it("converts epoch timestamps to ISO strings", () => {
    const exported = convertPost(samplePost);
    expect(exported.created_at).toBe("2026-03-26T00:00:00.000Z");
    expect(exported.updated_at).toBe("2026-03-26T00:00:00.000Z");
    expect(exported.published_at).toBe("2026-03-26T00:00:00.000Z");
  });

  it("handles null published_at", () => {
    const exported = convertPost({ ...samplePost, published_at: null });
    expect(exported.published_at).toBeNull();
  });
});

describe("convertCategory", () => {
  it("converts epoch timestamps", () => {
    const exported = convertCategory(sampleCategory);
    expect(exported.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("convertTag", () => {
  it("converts epoch timestamps", () => {
    const exported = convertTag(sampleTag);
    expect(exported.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("convertComment", () => {
  it("converts epoch timestamps", () => {
    const exported = convertComment(sampleComment);
    expect(exported.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("convertAttachment", () => {
  it("converts epoch timestamps", () => {
    const exported = convertAttachment(sampleAttachment);
    expect(exported.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("convertRedirect", () => {
  it("converts epoch timestamps", () => {
    const exported = convertRedirect(sampleRedirect);
    expect(exported.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("convertSiteSettings", () => {
  it("converts updated_at to ISO string", () => {
    const exported = convertSiteSettings(sampleSettingsRow);
    expect(exported.updated_at).toBe("2026-03-26T00:00:00.000Z");
  });

  it("preserves all whitelisted fields", () => {
    const exported = convertSiteSettings(sampleSettingsRow);
    expect(exported.locale).toBe("zh");
    expect(exported.site_name).toBe("Test Blog");
    expect(exported.ai_provider).toBe("anthropic");
  });
});

// ---------------------------------------------------------------------------
// SITE_SETTINGS_SQL whitelist
// ---------------------------------------------------------------------------

describe("SITE_SETTINGS_SQL", () => {
  it("does NOT contain ai_api_key", () => {
    expect(SITE_SETTINGS_SQL).not.toContain("ai_api_key");
  });

  it("does NOT contain backy_ columns", () => {
    expect(SITE_SETTINGS_SQL).not.toContain("backy_");
  });

  it("contains all expected safe columns", () => {
    const expectedColumns = [
      "locale",
      "posts_per_page",
      "comments_enabled",
      "font_style",
      "site_logo_version",
      "site_name",
      "site_tagline",
      "site_description",
      "site_author",
      "author_email",
      "twitter_handle",
      "social_links",
      "ai_provider",
      "ai_model",
      "ai_base_url",
      "ai_sdk_type",
      "updated_at",
    ];
    for (const col of expectedColumns) {
      expect(SITE_SETTINGS_SQL).toContain(col);
    }
  });
});

// ---------------------------------------------------------------------------
// collectBackupData
// ---------------------------------------------------------------------------

describe("collectBackupData", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
    vi.mocked(db.query)
      .mockResolvedValueOnce(mockResult([samplePost]))        // posts
      .mockResolvedValueOnce(mockResult([sampleCategory]))    // categories
      .mockResolvedValueOnce(mockResult([sampleTag]))         // tags
      .mockResolvedValueOnce(mockResult([{ post_id: "01HX1234", tag_id: "tag1" }])) // postTags
      .mockResolvedValueOnce(mockResult([sampleComment]))     // comments
      .mockResolvedValueOnce(mockResult([sampleAttachment]))  // attachments
      .mockResolvedValueOnce(mockResult([sampleRedirect]));   // redirects
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleSettingsRow);
  });

  it("returns envelope with correct schema version", async () => {
    const envelope = await collectBackupData(db);
    expect(envelope.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
  });

  it("includes exportedAt as ISO string", async () => {
    const envelope = await collectBackupData(db);
    expect(envelope.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("includes all entity arrays", async () => {
    const envelope = await collectBackupData(db);
    expect(envelope.posts).toHaveLength(1);
    expect(envelope.categories).toHaveLength(1);
    expect(envelope.tags).toHaveLength(1);
    expect(envelope.postTags).toHaveLength(1);
    expect(envelope.comments).toHaveLength(1);
    expect(envelope.attachments).toHaveLength(1);
    expect(envelope.redirects).toHaveLength(1);
  });

  it("converts timestamps to ISO in posts", async () => {
    const envelope = await collectBackupData(db);
    expect(envelope.posts[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("queries all 7 tables with ORDER BY", async () => {
    await collectBackupData(db);
    const queryCalls = vi.mocked(db.query).mock.calls;
    expect(queryCalls).toHaveLength(7);

    expect(queryCalls[0][0]).toContain("ORDER BY id");     // posts
    expect(queryCalls[1][0]).toContain("ORDER BY id");     // categories
    expect(queryCalls[2][0]).toContain("ORDER BY id");     // tags
    expect(queryCalls[3][0]).toContain("ORDER BY post_id, tag_id"); // postTags
    expect(queryCalls[4][0]).toContain("ORDER BY id");     // comments
    expect(queryCalls[5][0]).toContain("ORDER BY id");     // attachments
    expect(queryCalls[6][0]).toContain("ORDER BY id");     // redirects
  });

  it("uses site_settings column whitelist (no SELECT *)", async () => {
    await collectBackupData(db);
    expect(db.firstOrNull).toHaveBeenCalledWith(
      expect.not.stringContaining("SELECT *"),
    );
  });

  it("uses default settings when no row found", async () => {
    vi.mocked(db.firstOrNull).mockResolvedValue(null);
    const envelope = await collectBackupData(db);
    expect(envelope.siteSettings.site_name).toBe("My Blog");
  });
});

// ---------------------------------------------------------------------------
// serializeBackup
// ---------------------------------------------------------------------------

describe("serializeBackup", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
    vi.mocked(db.query)
      .mockResolvedValueOnce(mockResult([samplePost]))
      .mockResolvedValueOnce(mockResult([sampleCategory]))
      .mockResolvedValueOnce(mockResult([sampleTag]))
      .mockResolvedValueOnce(mockResult([{ post_id: "01HX1234", tag_id: "tag1" }]))
      .mockResolvedValueOnce(mockResult([sampleComment]))
      .mockResolvedValueOnce(mockResult([sampleAttachment]))
      .mockResolvedValueOnce(mockResult([sampleRedirect]));
    vi.mocked(db.firstOrNull).mockResolvedValue(sampleSettingsRow);
  });

  it("returns a gzip-compressed buffer", async () => {
    const { buffer } = await serializeBackup(db);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    // Gzip magic number: 1f 8b
    expect(buffer[0]).toBe(0x1f);
    expect(buffer[1]).toBe(0x8b);
  });

  it("decompresses to valid JSON with correct schema", async () => {
    const { buffer } = await serializeBackup(db);
    const json = gunzipSync(buffer).toString("utf-8");
    const parsed = JSON.parse(json) as FireflyBackupEnvelope;

    expect(parsed.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(parsed.posts).toHaveLength(1);
    expect(parsed.categories).toHaveLength(1);
    expect(parsed.siteSettings).toBeDefined();
  });

  it("returns envelope alongside buffer", async () => {
    const { envelope } = await serializeBackup(db);
    expect(envelope.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(envelope.posts).toHaveLength(1);
  });

  it("compressed buffer is smaller than raw JSON", async () => {
    const { buffer, envelope } = await serializeBackup(db);
    const rawSize = Buffer.byteLength(JSON.stringify(envelope));
    expect(buffer.length).toBeLessThan(rawSize);
  });
});
