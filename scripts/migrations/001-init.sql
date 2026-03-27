-- Migration 001: Initial schema
-- Applied to: firefly-db (prod) + firefly-db-test (test)
-- Source: docs/02-database-schema.md

-- ============================================================
-- users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,  -- ULID
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  avatar_url    TEXT,
  google_id     TEXT UNIQUE,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'reader')),
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- ============================================================
-- categories
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id            TEXT PRIMARY KEY,  -- ULID
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  post_count    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- ============================================================
-- tags
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
  id            TEXT PRIMARY KEY,  -- ULID
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  post_count    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);

-- ============================================================
-- posts
-- ============================================================
CREATE TABLE IF NOT EXISTS posts (
  id              TEXT PRIMARY KEY,  -- ULID
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  content         TEXT NOT NULL DEFAULT '',
  excerpt         TEXT,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'private', 'archived')),
  category_id     TEXT REFERENCES categories(id) ON DELETE SET NULL,
  featured_image  TEXT,
  comment_enabled INTEGER NOT NULL DEFAULT 0,
  comment_count   INTEGER NOT NULL DEFAULT 0,
  view_count      INTEGER NOT NULL DEFAULT 0,
  reading_time    INTEGER,
  wp_id           INTEGER,
  wp_permalink    TEXT,
  published_at    INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_at);
CREATE INDEX IF NOT EXISTS idx_posts_wp_id ON posts(wp_id);
CREATE INDEX IF NOT EXISTS idx_posts_wp_permalink ON posts(wp_permalink);

-- ============================================================
-- post_tags (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS post_tags (
  post_id   TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id    TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);

-- ============================================================
-- comments (read-only historical, no new submissions)
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
  id              TEXT PRIMARY KEY,  -- ULID
  post_id         TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  parent_id       TEXT REFERENCES comments(id) ON DELETE CASCADE,
  author_name     TEXT NOT NULL,
  author_email    TEXT,
  author_url      TEXT,
  content         TEXT NOT NULL,
  wp_id           INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

-- ============================================================
-- attachments (R2 object metadata)
-- ============================================================
CREATE TABLE IF NOT EXISTS attachments (
  id            TEXT PRIMARY KEY,  -- ULID
  filename      TEXT NOT NULL,
  r2_key        TEXT NOT NULL UNIQUE,
  mime_type     TEXT NOT NULL,
  size          INTEGER,
  width         INTEGER,
  height        INTEGER,
  alt_text      TEXT,
  wp_id         INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_attachments_r2_key ON attachments(r2_key);
CREATE INDEX IF NOT EXISTS idx_attachments_wp_id ON attachments(wp_id);

-- ============================================================
-- page_views (analytics)
-- ============================================================
CREATE TABLE IF NOT EXISTS page_views (
  id            TEXT PRIMARY KEY,  -- ULID
  post_id       TEXT REFERENCES posts(id) ON DELETE SET NULL,
  path          TEXT NOT NULL,
  referrer      TEXT,
  user_agent    TEXT,
  ip_hash       TEXT,
  country       TEXT,
  city          TEXT,
  device_type   TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'bot')),
  browser       TEXT,
  os            TEXT,
  is_bot        INTEGER NOT NULL DEFAULT 0,
  bot_name      TEXT,
  bot_category  TEXT CHECK (bot_category IN ('search', 'ai', 'social', 'monitor', 'other')),
  session_id    TEXT,
  viewed_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_page_views_post ON page_views(post_id);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path);
CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at ON page_views(viewed_at);
CREATE INDEX IF NOT EXISTS idx_page_views_bot ON page_views(is_bot, bot_category);
CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id);

-- ============================================================
-- daily_stats (pre-aggregated per-post daily)
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_stats (
  date          TEXT NOT NULL,
  post_id       TEXT REFERENCES posts(id) ON DELETE CASCADE,
  views         INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  bot_views     INTEGER NOT NULL DEFAULT 0,
  ai_bot_views  INTEGER NOT NULL DEFAULT 0,
  search_bot_views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, post_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);

-- ============================================================
-- site_daily_stats (site-wide daily aggregates)
-- ============================================================
CREATE TABLE IF NOT EXISTS site_daily_stats (
  date              TEXT PRIMARY KEY,
  total_views       INTEGER NOT NULL DEFAULT 0,
  unique_visitors   INTEGER NOT NULL DEFAULT 0,
  total_bot_views   INTEGER NOT NULL DEFAULT 0,
  ai_bot_views      INTEGER NOT NULL DEFAULT 0,
  search_bot_views  INTEGER NOT NULL DEFAULT 0,
  top_referrers     TEXT,
  top_countries     TEXT,
  top_browsers      TEXT
);

-- ============================================================
-- redirects (WordPress URL → new URL mapping)
-- ============================================================
CREATE TABLE IF NOT EXISTS redirects (
  id            TEXT PRIMARY KEY,  -- ULID
  source_path   TEXT NOT NULL UNIQUE,
  target_path   TEXT NOT NULL,
  status_code   INTEGER NOT NULL DEFAULT 301,
  hit_count     INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_redirects_source ON redirects(source_path);
