-- Migration 004: Add font_style to site_settings
-- Allows users to choose between classic/serif/sans typography presets.

ALTER TABLE site_settings
  ADD COLUMN font_style TEXT NOT NULL DEFAULT 'classic'
  CHECK (font_style IN ('classic', 'serif', 'sans'));
