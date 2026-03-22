# 02 — Database Schema Design

## Platform: Cloudflare D1 (SQLite)

D1 constraints:
- No native UUID type — use TEXT with application-generated UUIDs or ULID
- No ENUM — use TEXT with CHECK constraints
- No stored procedures — all logic in application layer
- Max 10GB per database, 25ms CPU per query
- Use INTEGER for timestamps (unix epoch) for efficient indexing

## Schema

### users

Single user, but designed to support whitelist expansion.

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,  -- ULID
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  avatar_url    TEXT,
  google_id     TEXT UNIQUE,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'reader')),
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
```

### categories

```sql
CREATE TABLE categories (
  id            TEXT PRIMARY KEY,  -- ULID
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  post_count    INTEGER NOT NULL DEFAULT 0,  -- denormalized counter
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX idx_categories_slug ON categories(slug);
```

### tags

```sql
CREATE TABLE tags (
  id            TEXT PRIMARY KEY,  -- ULID
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  post_count    INTEGER NOT NULL DEFAULT 0,  -- denormalized counter
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX idx_tags_slug ON tags(slug);
```

### posts

Core content table. Stores markdown source, not rendered HTML.

```sql
CREATE TABLE posts (
  id              TEXT PRIMARY KEY,  -- ULID
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  content         TEXT NOT NULL DEFAULT '',        -- markdown source
  excerpt         TEXT,                             -- manual excerpt or auto-generated
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'private', 'archived')),
  category_id     TEXT REFERENCES categories(id) ON DELETE SET NULL,
  featured_image  TEXT,                             -- R2 key or URL
  comment_enabled INTEGER NOT NULL DEFAULT 0,      -- 0=off, 1=on (default off)
  comment_count   INTEGER NOT NULL DEFAULT 0,      -- denormalized
  view_count      INTEGER NOT NULL DEFAULT 0,      -- denormalized
  reading_time    INTEGER,                          -- estimated minutes
  wp_id           INTEGER,                          -- original WordPress post ID for migration
  wp_permalink    TEXT,                             -- original WordPress permalink for 301 redirects
  published_at    INTEGER,                          -- null if never published
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_category ON posts(category_id);
CREATE INDEX idx_posts_published ON posts(published_at);
CREATE INDEX idx_posts_wp_id ON posts(wp_id);
CREATE INDEX idx_posts_wp_permalink ON posts(wp_permalink);
```

### post_tags

Many-to-many join table.

```sql
CREATE TABLE post_tags (
  post_id   TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id    TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX idx_post_tags_tag ON post_tags(tag_id);
```

### comments

Threaded comments, migrated from WordPress. Default off for new posts.

```sql
CREATE TABLE comments (
  id              TEXT PRIMARY KEY,  -- ULID
  post_id         TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  parent_id       TEXT REFERENCES comments(id) ON DELETE CASCADE,
  author_name     TEXT NOT NULL,
  author_email    TEXT,
  author_url      TEXT,
  content         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'spam')),
  wp_id           INTEGER,           -- original WordPress comment ID
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);
CREATE INDEX idx_comments_status ON comments(status);
```

### attachments

Track R2 objects for admin management.

```sql
CREATE TABLE attachments (
  id            TEXT PRIMARY KEY,  -- ULID
  filename      TEXT NOT NULL,
  r2_key        TEXT NOT NULL UNIQUE,  -- e.g., "wp-content/uploads/2007/05/cis.gif"
  mime_type     TEXT NOT NULL,
  size          INTEGER,               -- bytes
  width         INTEGER,               -- pixels, for images
  height        INTEGER,               -- pixels, for images
  alt_text      TEXT,
  wp_id         INTEGER,               -- original WordPress attachment ID
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_attachments_r2_key ON attachments(r2_key);
CREATE INDEX idx_attachments_wp_id ON attachments(wp_id);
```

### page_views

Lightweight analytics. One row per view event, aggregated via queries.

```sql
CREATE TABLE page_views (
  id            TEXT PRIMARY KEY,  -- ULID
  post_id       TEXT REFERENCES posts(id) ON DELETE SET NULL,
  path          TEXT NOT NULL,
  referrer      TEXT,
  user_agent    TEXT,
  ip_hash       TEXT,              -- hashed IP, never raw IP
  country       TEXT,
  city          TEXT,
  device_type   TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'bot')),
  browser       TEXT,
  os            TEXT,
  is_bot        INTEGER NOT NULL DEFAULT 0,
  bot_name      TEXT,              -- e.g., "Googlebot", "GPTBot", "ClaudeBot"
  bot_category  TEXT CHECK (bot_category IN ('search', 'ai', 'social', 'monitor', 'other')),
  session_id    TEXT,              -- anonymous session grouping
  viewed_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_page_views_post ON page_views(post_id);
CREATE INDEX idx_page_views_path ON page_views(path);
CREATE INDEX idx_page_views_viewed_at ON page_views(viewed_at);
CREATE INDEX idx_page_views_bot ON page_views(is_bot, bot_category);
CREATE INDEX idx_page_views_session ON page_views(session_id);
```

### daily_stats

Pre-aggregated daily stats for dashboard performance.

```sql
CREATE TABLE daily_stats (
  date          TEXT NOT NULL,      -- YYYY-MM-DD
  post_id       TEXT REFERENCES posts(id) ON DELETE CASCADE,
  views         INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  bot_views     INTEGER NOT NULL DEFAULT 0,
  ai_bot_views  INTEGER NOT NULL DEFAULT 0,
  search_bot_views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, post_id)
);

CREATE INDEX idx_daily_stats_date ON daily_stats(date);
```

### site_daily_stats

Site-wide daily aggregates.

```sql
CREATE TABLE site_daily_stats (
  date              TEXT PRIMARY KEY,  -- YYYY-MM-DD
  total_views       INTEGER NOT NULL DEFAULT 0,
  unique_visitors   INTEGER NOT NULL DEFAULT 0,
  total_bot_views   INTEGER NOT NULL DEFAULT 0,
  ai_bot_views      INTEGER NOT NULL DEFAULT 0,
  search_bot_views  INTEGER NOT NULL DEFAULT 0,
  top_referrers     TEXT,              -- JSON array of {referrer, count}
  top_countries     TEXT,              -- JSON array of {country, count}
  top_browsers      TEXT               -- JSON array of {browser, count}
);
```

### redirects

Map old WordPress URLs to new clean URLs for 301 handling.

```sql
CREATE TABLE redirects (
  id            TEXT PRIMARY KEY,  -- ULID
  source_path   TEXT NOT NULL UNIQUE,  -- e.g., "/index.php/2026/01/some-slug/"
  target_path   TEXT NOT NULL,         -- e.g., "/2026/01/some-slug"
  status_code   INTEGER NOT NULL DEFAULT 301,
  hit_count     INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX idx_redirects_source ON redirects(source_path);
```

## Migration ID Mapping

WordPress uses auto-increment integer IDs. Firefly uses ULIDs.
The `wp_id` columns on posts, comments, and attachments enable:

1. 301 redirect generation from old permalink patterns
2. Cross-reference during comment parent_id remapping

Migration is a one-shot process: drop and recreate the D1 database if a re-run
is needed. No upsert or dedup logic required.

## Denormalized Counters

`post_count` on categories/tags and `comment_count`/`view_count` on posts are
denormalized for read performance. Updated via:
- Application-level increment/decrement on write operations
- Periodic reconciliation job (admin endpoint)
