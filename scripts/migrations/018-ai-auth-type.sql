-- Migration 018: AI auth type
-- Adds ai_auth_type column to allow overriding the default Anthropic
-- x-api-key header with Authorization: Bearer for LLM gateways
-- (e.g., manifest.nocoo.cloud) that only accept Bearer auth.
--
-- Values: '' (default — use SDK default), 'apiKey', 'bearer'.

ALTER TABLE site_settings ADD COLUMN ai_auth_type TEXT NOT NULL DEFAULT '';
