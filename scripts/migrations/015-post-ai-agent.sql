-- Posts: Add ai_agent_id field for direct agent authorship tracking
-- This allows:
--   1. Multiple AI agents per category (removes category_id UNIQUE from ai_agents)
--   2. Per-agent permission isolation (agent can only see own posts)
--   3. Direct author lookup without category→agent reverse query

-- 1. Add ai_agent_id to posts table
ALTER TABLE posts ADD COLUMN ai_agent_id TEXT REFERENCES ai_agents(id) ON DELETE SET NULL;
CREATE INDEX idx_posts_ai_agent ON posts(ai_agent_id);

-- 2. Rebuild ai_agents table to remove category_id UNIQUE constraint
-- SQLite doesn't support DROP CONSTRAINT, so we recreate the table
CREATE TABLE ai_agents_new (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  description       TEXT,
  category_id       TEXT NOT NULL              -- Removed UNIQUE: allows multiple agents per category
    REFERENCES categories(id) ON DELETE RESTRICT,
  api_key_hash      TEXT NOT NULL UNIQUE,
  api_key_preview   TEXT NOT NULL,
  avatar_version    TEXT,
  is_active         INTEGER NOT NULL DEFAULT 1,
  last_used_at      INTEGER,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);

INSERT INTO ai_agents_new SELECT * FROM ai_agents;
DROP TABLE ai_agents;
ALTER TABLE ai_agents_new RENAME TO ai_agents;

-- Recreate indexes
CREATE INDEX idx_ai_agents_category ON ai_agents(category_id);
CREATE INDEX idx_ai_agents_api_key_hash ON ai_agents(api_key_hash);
