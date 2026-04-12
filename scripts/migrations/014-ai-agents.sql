-- AI Agent Authors — static API key authentication for AI writing agents
CREATE TABLE ai_agents (
  id                TEXT PRIMARY KEY,           -- ULID
  name              TEXT NOT NULL,              -- Display name: "Claude Daily Journal"
  slug              TEXT NOT NULL UNIQUE,       -- URL identifier: "claude-daily-journal"
  description       TEXT,                       -- Optional description
  category_id       TEXT NOT NULL UNIQUE        -- Bound category (1:1, enforced by UNIQUE)
    REFERENCES categories(id) ON DELETE RESTRICT,
  api_key_hash      TEXT NOT NULL UNIQUE,       -- SHA-256 hash of firefly_agent_<hex>
  api_key_preview   TEXT NOT NULL,              -- Last 8 chars for identification
  avatar_version    TEXT,                       -- Avatar version (null = no avatar)
  is_active         INTEGER NOT NULL DEFAULT 1, -- 1=enabled, 0=disabled
  last_used_at      INTEGER,                    -- Last API key usage (epoch)
  created_at        INTEGER NOT NULL,           -- Creation time (epoch)
  updated_at        INTEGER NOT NULL            -- Last update time (epoch)
);

CREATE INDEX idx_ai_agents_api_key_hash ON ai_agents(api_key_hash);
