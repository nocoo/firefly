-- Migration 004: Add font_style to site_settings
-- Allows users to choose between classic/serif/sans typography presets.
-- Note: SQLite ALTER TABLE ADD COLUMN does not support inline CHECK constraints,
-- so validation is handled at the application layer.

ALTER TABLE site_settings
  ADD COLUMN font_style TEXT NOT NULL DEFAULT 'pingfang';
