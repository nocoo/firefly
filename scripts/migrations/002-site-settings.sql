-- Migration 002: Site settings (singleton row)
-- Stores global site configuration: locale, posts per page, comments toggle.

CREATE TABLE IF NOT EXISTS site_settings (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  locale           TEXT    NOT NULL DEFAULT 'zh' CHECK (locale IN ('en', 'zh')),
  posts_per_page   INTEGER NOT NULL DEFAULT 10,
  comments_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Seed with defaults
INSERT OR IGNORE INTO site_settings (id) VALUES (1);
