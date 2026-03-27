import { gzipSync } from "node:zlib";
import type { Db } from "@/lib/db";
import type {
  Post,
  Category,
  Tag,
  PostTag,
  Comment,
  Attachment,
  Redirect,
} from "@/models/types";
import {
  BACKUP_SCHEMA_VERSION,
  epochToIso,
  nullableEpochToIso,
} from "@/models/backup-schema";
import type {
  FireflyBackupEnvelope,
  ExportedPost,
  ExportedCategory,
  ExportedTag,
  ExportedComment,
  ExportedAttachment,
  ExportedRedirect,
  ExportedSiteSettings,
} from "@/models/backup-schema";
import { APP_VERSION } from "@/lib/version";

// ---------------------------------------------------------------------------
// Site settings row (only the columns we backup — explicit whitelist)
// ---------------------------------------------------------------------------

interface BackupSiteSettingsRow {
  locale: string;
  posts_per_page: number;
  comments_enabled: number;
  font_style: string;
  site_logo_version: string | null;
  site_name: string;
  site_tagline: string;
  site_description: string;
  site_author: string;
  author_email: string;
  twitter_handle: string;
  social_links: string;
  ai_provider: string;
  ai_model: string;
  ai_base_url: string;
  ai_sdk_type: string;
  updated_at: number;
}

// ---------------------------------------------------------------------------
// SQL for site_settings — explicit column whitelist
// Excludes: id, ai_api_key, backy_webhook_url, backy_api_key, backy_pull_key
// ---------------------------------------------------------------------------

const SITE_SETTINGS_SQL =
  "SELECT locale, posts_per_page, comments_enabled, font_style, " +
  "site_logo_version, site_name, site_tagline, site_description, " +
  "site_author, author_email, twitter_handle, social_links, " +
  "ai_provider, ai_model, ai_base_url, ai_sdk_type, updated_at " +
  "FROM site_settings WHERE id = 1";

// ---------------------------------------------------------------------------
// Entity converters (epoch → ISO)
// ---------------------------------------------------------------------------

function convertPost(p: Post): ExportedPost {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    content: p.content,
    content_html: p.content_html,
    excerpt: p.excerpt,
    status: p.status,
    category_id: p.category_id,
    featured_image: p.featured_image,
    comment_enabled: p.comment_enabled,
    comment_count: p.comment_count,
    view_count: p.view_count,
    reading_time: p.reading_time,
    wp_id: p.wp_id,
    wp_permalink: p.wp_permalink,
    reference_url: p.reference_url,
    reference_title: p.reference_title,
    reference_description: p.reference_description,
    reference_image: p.reference_image,
    published_at: nullableEpochToIso(p.published_at),
    created_at: epochToIso(p.created_at),
    updated_at: epochToIso(p.updated_at),
  };
}

function convertCategory(c: Category): ExportedCategory {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    sort_order: c.sort_order,
    post_count: c.post_count,
    created_at: epochToIso(c.created_at),
    updated_at: epochToIso(c.updated_at),
  };
}

function convertTag(t: Tag): ExportedTag {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    post_count: t.post_count,
    created_at: epochToIso(t.created_at),
    updated_at: epochToIso(t.updated_at),
  };
}

function convertComment(c: Comment): ExportedComment {
  return {
    id: c.id,
    post_id: c.post_id,
    parent_id: c.parent_id,
    author_name: c.author_name,
    author_email: c.author_email,
    author_url: c.author_url,
    content: c.content,
    wp_id: c.wp_id,
    created_at: epochToIso(c.created_at),
  };
}

function convertAttachment(a: Attachment): ExportedAttachment {
  return {
    id: a.id,
    filename: a.filename,
    r2_key: a.r2_key,
    mime_type: a.mime_type,
    size: a.size,
    width: a.width,
    height: a.height,
    alt_text: a.alt_text,
    post_id: a.post_id,
    wp_id: a.wp_id,
    created_at: epochToIso(a.created_at),
  };
}

function convertRedirect(r: Redirect): ExportedRedirect {
  return {
    id: r.id,
    source_path: r.source_path,
    target_path: r.target_path,
    status_code: r.status_code,
    hit_count: r.hit_count,
    created_at: epochToIso(r.created_at),
  };
}

function convertSiteSettings(row: BackupSiteSettingsRow): ExportedSiteSettings {
  return {
    locale: row.locale,
    posts_per_page: row.posts_per_page,
    comments_enabled: row.comments_enabled,
    font_style: row.font_style,
    site_logo_version: row.site_logo_version,
    site_name: row.site_name,
    site_tagline: row.site_tagline,
    site_description: row.site_description,
    site_author: row.site_author,
    author_email: row.author_email,
    twitter_handle: row.twitter_handle,
    social_links: row.social_links,
    ai_provider: row.ai_provider,
    ai_model: row.ai_model,
    ai_base_url: row.ai_base_url,
    ai_sdk_type: row.ai_sdk_type,
    updated_at: epochToIso(row.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Collect all backup data
// ---------------------------------------------------------------------------

/** Collect all backup data from DB into a FireflyBackupEnvelope. */
export async function collectBackupData(
  db: Db,
): Promise<FireflyBackupEnvelope> {
  const [posts, categories, tags, postTags, comments, attachments, redirects, settings] =
    await Promise.all([
      db.query<Post>("SELECT * FROM posts ORDER BY id"),
      db.query<Category>("SELECT * FROM categories ORDER BY id"),
      db.query<Tag>("SELECT * FROM tags ORDER BY id"),
      db.query<PostTag>("SELECT * FROM post_tags ORDER BY post_id, tag_id"),
      db.query<Comment>("SELECT * FROM comments ORDER BY id"),
      db.query<Attachment>("SELECT * FROM attachments ORDER BY id"),
      db.query<Redirect>("SELECT * FROM redirects ORDER BY id"),
      db.firstOrNull<BackupSiteSettingsRow>(SITE_SETTINGS_SQL),
    ]);

  const defaultSettings: ExportedSiteSettings = {
    locale: "zh",
    posts_per_page: 10,
    comments_enabled: 0,
    font_style: "pingfang",
    site_logo_version: null,
    site_name: "My Blog",
    site_tagline: "",
    site_description: "",
    site_author: "",
    author_email: "",
    twitter_handle: "",
    social_links: "[]",
    ai_provider: "",
    ai_model: "",
    ai_base_url: "",
    ai_sdk_type: "",
    updated_at: new Date(0).toISOString(),
  };

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    posts: posts.results.map(convertPost),
    categories: categories.results.map(convertCategory),
    tags: tags.results.map(convertTag),
    postTags: postTags.results,
    comments: comments.results.map(convertComment),
    attachments: attachments.results.map(convertAttachment),
    redirects: redirects.results.map(convertRedirect),
    siteSettings: settings ? convertSiteSettings(settings) : defaultSettings,
  };
}

// ---------------------------------------------------------------------------
// Serialize + compress
// ---------------------------------------------------------------------------

export interface SerializedBackup {
  buffer: Buffer;
  envelope: FireflyBackupEnvelope;
}

/**
 * Collect all backup data, serialize to JSON, and gzip compress.
 * Returns the compressed buffer and the raw envelope (for stats).
 */
export async function serializeBackup(db: Db): Promise<SerializedBackup> {
  const envelope = await collectBackupData(db);
  const json = JSON.stringify(envelope);
  const buffer = Buffer.from(gzipSync(Buffer.from(json)));
  return { buffer, envelope };
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** @internal — exposed for unit tests only */
export const _testHelpers = {
  convertPost,
  convertCategory,
  convertTag,
  convertComment,
  convertAttachment,
  convertRedirect,
  convertSiteSettings,
  SITE_SETTINGS_SQL,
};
