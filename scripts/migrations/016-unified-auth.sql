-- Phase 2: Unified Authentication + Scope Model
--
-- Changes:
-- 1. Simplify ai_agents table: remove authentication fields (api_key_hash, api_key_preview, is_active, last_used_at)
--    AI Authors are now just identity records, not authentication endpoints
-- 2. Add scope field to mcp_tokens: "full" (admin) or "author" (AI writing mode)

-- 1. Rebuild ai_agents table without auth fields
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

-- 2. Add scope to mcp_tokens (default to 'full' for existing tokens)
ALTER TABLE mcp_tokens ADD COLUMN scope TEXT NOT NULL DEFAULT 'full';
