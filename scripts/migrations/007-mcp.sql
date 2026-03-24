-- MCP (Model Context Protocol) tables for OAuth 2.1 and tool access
-- Supports dynamic client registration, authorization code flow with PKCE, and bearer token auth.

-- Dynamic Client Registration (RFC 7591)
CREATE TABLE mcp_clients (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL UNIQUE,
  client_name     TEXT NOT NULL,
  client_secret   TEXT,
  redirect_uris   TEXT NOT NULL,
  grant_types     TEXT NOT NULL DEFAULT '["authorization_code"]',
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX idx_mcp_clients_client_id ON mcp_clients(client_id);

-- OAuth Authorization Sessions & Codes
CREATE TABLE mcp_auth_codes (
  state                  TEXT PRIMARY KEY,
  code                   TEXT UNIQUE,
  client_id              TEXT NOT NULL,
  redirect_uri           TEXT NOT NULL,
  code_challenge         TEXT NOT NULL,
  code_challenge_method  TEXT NOT NULL DEFAULT 'S256',
  user_email             TEXT,
  scope                  TEXT NOT NULL DEFAULT 'mcp:full',
  expires_at             INTEGER NOT NULL,
  consumed               INTEGER NOT NULL DEFAULT 0,
  created_at             INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX idx_mcp_auth_codes_code ON mcp_auth_codes(code);
CREATE INDEX idx_mcp_auth_codes_expires ON mcp_auth_codes(expires_at);

-- Persistent Access & Refresh Tokens (hash-only storage)
CREATE TABLE mcp_tokens (
  id                    TEXT PRIMARY KEY,
  access_token_hash     TEXT NOT NULL UNIQUE,
  access_token_preview  TEXT NOT NULL,
  refresh_token_hash    TEXT UNIQUE,
  client_id             TEXT NOT NULL,
  user_email            TEXT NOT NULL,
  scope                 TEXT NOT NULL DEFAULT 'mcp:full',
  client_name           TEXT,
  last_used_at          INTEGER,
  expires_at            INTEGER NOT NULL,
  refresh_expires_at    INTEGER,
  revoked               INTEGER NOT NULL DEFAULT 0,
  revoked_at            INTEGER,
  created_at            INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX idx_mcp_tokens_access ON mcp_tokens(access_token_hash);
CREATE UNIQUE INDEX idx_mcp_tokens_refresh ON mcp_tokens(refresh_token_hash);
CREATE INDEX idx_mcp_tokens_user ON mcp_tokens(user_email);
