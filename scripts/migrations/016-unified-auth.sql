-- Phase 2: Unified Authentication + Scope Model
--
-- Changes:
-- 1. Simplify ai_agents table: remove authentication fields (api_key_hash, api_key_preview, is_active, last_used_at)
--    AI Authors are now just identity records, not authentication endpoints
-- 2. Add scope field to mcp_tokens: "full" (admin) or "author" (AI writing mode)

-- Part 1: Add scope to mcp_tokens (idempotent — runner skips if column exists)
ALTER TABLE mcp_tokens ADD COLUMN scope TEXT NOT NULL DEFAULT 'full';

-- @batch
-- Part 2: Rebuild ai_agents table without auth fields
-- NOTE: @batch is required because PRAGMA foreign_keys is connection-level state.
-- Without batch mode, each statement runs in a separate HTTP request (= separate connection),
-- so FK enforcement would NOT be disabled when DROP TABLE executes.
--
-- CRITICAL: Temporarily disable FK enforcement to prevent ON DELETE SET NULL
--           from clearing posts.ai_agent_id when we drop the old table.
PRAGMA foreign_keys = OFF;

CREATE TABLE ai_agents_new (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  description       TEXT,
  category_id       TEXT NOT NULL
    REFERENCES categories(id) ON DELETE RESTRICT,
  avatar_version    TEXT,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);

INSERT INTO ai_agents_new (id, name, slug, description, category_id, avatar_version, created_at, updated_at)
SELECT id, name, slug, description, category_id, avatar_version, created_at, updated_at
FROM ai_agents;

DROP TABLE ai_agents;
ALTER TABLE ai_agents_new RENAME TO ai_agents;

CREATE INDEX idx_ai_agents_category ON ai_agents(category_id);

-- Re-enable FK enforcement
PRAGMA foreign_keys = ON;
