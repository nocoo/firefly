// Backup schema — envelope structure and exported entity types.
// All Exported* interfaces mirror D1 column names (snake_case),
// with timestamps converted from Unix epoch to ISO 8601 strings.

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

export const BACKUP_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Epoch → ISO helpers
// ---------------------------------------------------------------------------

/** Convert a Unix epoch (seconds) to an ISO 8601 string */
export function epochToIso(epoch: number): string {
  return new Date(epoch * 1000).toISOString();
}

/** Convert a nullable Unix epoch (seconds) to an ISO 8601 string or null */
export function nullableEpochToIso(epoch: number | null): string | null {
  return epoch === null ? null : new Date(epoch * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Exported entity types
// ---------------------------------------------------------------------------

export interface ExportedPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  content_html: string | null;
  excerpt: string | null;
  status: "draft" | "published" | "private" | "archived";
  category_id: string | null;
  featured_image: string | null;
  comment_enabled: number;
  comment_count: number;
  view_count: number;
  reading_time: number | null;
  wp_id: number | null;
  wp_permalink: string | null;
  reference_url: string | null;
  reference_title: string | null;
  reference_description: string | null;
  reference_image: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExportedCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  post_count: number;
  created_at: string;
  updated_at: string;
}

export interface ExportedTag {
  id: string;
  name: string;
  slug: string;
  post_count: number;
  created_at: string;
  updated_at: string;
}

export interface ExportedPostTag {
  post_id: string;
  tag_id: string;
}

export interface ExportedComment {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_name: string;
  author_email: string | null;
  author_url: string | null;
  content: string;
  wp_id: number | null;
  created_at: string;
}

export interface ExportedAttachment {
  id: string;
  filename: string;
  r2_key: string;
  mime_type: string;
  size: number | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  post_id: string | null;
  wp_id: number | null;
  created_at: string;
}

export interface ExportedRedirect {
  id: string;
  source_path: string;
  target_path: string;
  status_code: number;
  hit_count: number;
  created_at: string;
}

export interface ExportedSiteSettings {
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
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Backup envelope
// ---------------------------------------------------------------------------

export interface FireflyBackupEnvelope {
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  appVersion: string;
  posts: ExportedPost[];
  categories: ExportedCategory[];
  tags: ExportedTag[];
  postTags: ExportedPostTag[];
  comments: ExportedComment[];
  attachments: ExportedAttachment[];
  redirects: ExportedRedirect[];
  siteSettings: ExportedSiteSettings;
}
