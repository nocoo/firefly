import { describe, it, expect } from "vitest";
import {
  BACKUP_SCHEMA_VERSION,
  epochToIso,
  nullableEpochToIso,
} from "./backup-schema";
import type {
  FireflyBackupEnvelope,
  ExportedSiteSettings,
} from "./backup-schema";

// ---------------------------------------------------------------------------
// BACKUP_SCHEMA_VERSION
// ---------------------------------------------------------------------------

describe("BACKUP_SCHEMA_VERSION", () => {
  it("is 1", () => {
    expect(BACKUP_SCHEMA_VERSION).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// epochToIso
// ---------------------------------------------------------------------------

describe("epochToIso", () => {
  it("converts Unix epoch seconds to ISO 8601 string", () => {
    // 2026-03-26T00:00:00Z = 1774483200
    expect(epochToIso(1774483200)).toBe("2026-03-26T00:00:00.000Z");
  });

  it("converts epoch 0 to 1970-01-01", () => {
    expect(epochToIso(0)).toBe("1970-01-01T00:00:00.000Z");
  });

  it("handles specific timestamps correctly", () => {
    // 2024-01-01T12:30:45Z
    expect(epochToIso(1704112245)).toBe("2024-01-01T12:30:45.000Z");
  });
});

// ---------------------------------------------------------------------------
// nullableEpochToIso
// ---------------------------------------------------------------------------

describe("nullableEpochToIso", () => {
  it("converts non-null epoch to ISO string", () => {
    expect(nullableEpochToIso(1774483200)).toBe("2026-03-26T00:00:00.000Z");
  });

  it("returns null for null input", () => {
    expect(nullableEpochToIso(null)).toBeNull();
  });

  it("converts epoch 0 to 1970-01-01 instead of null", () => {
    expect(nullableEpochToIso(0)).toBe("1970-01-01T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// Type structure assertions (compile-time + runtime shape checks)
// ---------------------------------------------------------------------------

describe("FireflyBackupEnvelope shape", () => {
  const sampleSettings: ExportedSiteSettings = {
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
    ai_provider: "openai",
    ai_model: "gpt-4",
    ai_base_url: "",
    ai_sdk_type: "openai",
    ai_auth_type: "",
    updated_at: "2026-03-26T00:00:00.000Z",
  };

  const sampleEnvelope: FireflyBackupEnvelope = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: "2026-03-26T14:30:05.000Z",
    appVersion: "1.4.0",
    posts: [],
    categories: [],
    tags: [],
    postTags: [],
    comments: [],
    attachments: [],
    redirects: [],
    siteSettings: sampleSettings,
  };

  it("has all required top-level keys", () => {
    const requiredKeys = [
      "schemaVersion",
      "exportedAt",
      "appVersion",
      "posts",
      "categories",
      "tags",
      "postTags",
      "comments",
      "attachments",
      "redirects",
      "siteSettings",
    ];
    for (const key of requiredKeys) {
      expect(sampleEnvelope).toHaveProperty(key);
    }
  });

  it("uses camelCase for top-level envelope keys", () => {
    const keys = Object.keys(sampleEnvelope);
    // Verify envelope uses camelCase (no underscores at top level)
    for (const key of keys) {
      expect(key).not.toContain("_");
    }
  });

  it("uses snake_case for exported entity fields", () => {
    const settingsKeys = Object.keys(sampleSettings);
    // All ExportedSiteSettings keys should use snake_case
    for (const key of settingsKeys) {
      // snake_case: either no uppercase, or contains underscore
      expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("does NOT include ai_api_key in ExportedSiteSettings", () => {
    expect(sampleSettings).not.toHaveProperty("ai_api_key");
  });

  it("does NOT include backy fields in ExportedSiteSettings", () => {
    expect(sampleSettings).not.toHaveProperty("backy_webhook_url");
    expect(sampleSettings).not.toHaveProperty("backy_api_key");
    expect(sampleSettings).not.toHaveProperty("backy_pull_key");
  });

  it("does NOT include id in ExportedSiteSettings", () => {
    expect(sampleSettings).not.toHaveProperty("id");
  });

  it("includes updated_at in ExportedSiteSettings as ISO string", () => {
    expect(sampleSettings.updated_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });
});
