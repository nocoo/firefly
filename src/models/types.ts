// ---------------------------------------------------------------------------
// Domain types — mirror of 001-init.sql schema
// Pure interfaces, no runtime dependencies
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

export interface User {
  id: string; // ULID
  email: string;
  name: string;
  avatar_url: string | null;
  google_id: string | null;
  role: "admin" | "reader";
  created_at: number; // unix epoch
  updated_at: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  post_count: number;
  created_at: number;
  updated_at: number;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  post_count: number;
  created_at: number;
  updated_at: number;
}

export type PostStatus = "draft" | "published" | "private" | "archived";

export interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  content_html: string | null;
  excerpt: string | null;
  status: PostStatus;
  category_id: string | null;
  ai_agent_id: string | null;
  featured_image: string | null;
  comment_enabled: number; // 0 | 1
  comment_count: number;
  view_count: number;
  reading_time: number | null;
  wp_id: number | null;
  wp_permalink: string | null;
  reference_url: string | null;
  reference_title: string | null;
  reference_description: string | null;
  reference_image: string | null;
  published_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface PostTag {
  post_id: string;
  tag_id: string;
}

// ---------------------------------------------------------------------------
// Comments (read-only historical)
// ---------------------------------------------------------------------------

export interface Comment {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_name: string;
  author_email: string | null;
  author_url: string | null;
  content: string;
  wp_id: number | null;
  created_at: number;
}

// ---------------------------------------------------------------------------
// Attachments (R2 metadata)
// ---------------------------------------------------------------------------

export interface Attachment {
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
  created_at: number;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export type DeviceType = "desktop" | "mobile" | "tablet" | "bot";
export type BotCategory = "search" | "ai" | "social" | "monitor" | "other";

export interface PageView {
  id: string;
  post_id: string | null;
  path: string;
  referrer: string | null;
  user_agent: string | null;
  ip_hash: string | null;
  country: string | null;
  city: string | null;
  device_type: DeviceType | null;
  browser: string | null;
  os: string | null;
  is_bot: number; // 0 | 1
  bot_name: string | null;
  bot_category: BotCategory | null;
  session_id: string | null;
  viewed_at: number;
}

export interface DailyStat {
  date: string; // YYYY-MM-DD
  post_id: string;
  views: number;
  unique_visitors: number;
  bot_views: number;
  ai_bot_views: number;
  search_bot_views: number;
}

export interface SiteDailyStat {
  date: string;
  total_views: number;
  unique_visitors: number;
  total_bot_views: number;
  ai_bot_views: number;
  search_bot_views: number;
  top_referrers: string | null; // JSON
  top_countries: string | null; // JSON
  top_browsers: string | null; // JSON
}

// ---------------------------------------------------------------------------
// Redirects
// ---------------------------------------------------------------------------

export interface Redirect {
  id: string;
  source_path: string;
  target_path: string;
  status_code: number;
  hit_count: number;
  created_at: number;
}

// ---------------------------------------------------------------------------
// Query helpers (used by data layer)
// ---------------------------------------------------------------------------

export interface PostWithCategory extends Post {
  category_name: string | null;
  category_slug: string | null;
}

export interface PostWithAgent extends PostWithCategory {
  agent_name: string | null;
  agent_slug: string | null;
  agent_avatar_version: string | null;
}

export interface PostWithTags extends PostWithCategory {
  tags: Pick<Tag, "id" | "name" | "slug">[];
}

export interface CommentTree extends Comment {
  children: CommentTree[];
}

// ---------------------------------------------------------------------------
// AI Agent Authors — static API key authentication
// ---------------------------------------------------------------------------

export interface AiAgent {
  id: string; // ULID
  name: string;
  slug: string;
  description: string | null;
  category_id: string;
  api_key_hash: string;
  api_key_preview: string; // Last 8 chars
  avatar_version: string | null;
  is_active: number; // 0 | 1
  last_used_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface AiAgentWithCategory extends AiAgent {
  category_name: string;
  category_slug: string;
  /** Number of posts authored by this agent (for deletion check) */
  post_count: number;
}

// ---------------------------------------------------------------------------
// MCP (Model Context Protocol) — OAuth 2.1 + tool access
// ---------------------------------------------------------------------------

/** Dynamic Client Registration (RFC 7591) */
export interface McpClient {
  id: string; // ULID
  client_id: string;
  client_name: string;
  client_secret: string | null;
  redirect_uris: string; // JSON array
  grant_types: string; // JSON array
  created_at: number;
}

/** OAuth authorization session / code */
export interface McpAuthCode {
  state: string; // PK, CSRF state param
  code: string | null; // set after Google callback
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  user_email: string | null;
  scope: string;
  expires_at: number;
  consumed: number; // 0 = unused, 1 = consumed
  created_at: number;
}

/** Persistent access & refresh token (hash-only storage) */
export interface McpToken {
  id: string; // ULID
  access_token_hash: string;
  access_token_preview: string;
  refresh_token_hash: string | null;
  client_id: string;
  user_email: string;
  scope: string;
  client_name: string | null;
  last_used_at: number | null;
  expires_at: number;
  refresh_expires_at: number | null;
  revoked: number; // 0 = active, 1 = revoked
  revoked_at: number | null;
  created_at: number;
}
