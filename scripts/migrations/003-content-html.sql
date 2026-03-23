-- Migration 003: Pre-rendered HTML column for post content
-- Stores the HTML output of markdown rendering to avoid re-parsing on every request.

ALTER TABLE posts ADD COLUMN content_html TEXT;
