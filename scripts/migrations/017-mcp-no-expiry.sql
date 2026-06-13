-- Remove expiry from MCP tokens
--
-- MCP tokens are issued to long-lived agent clients on a single-user blog.
-- Rotation already happens on every refresh; absolute expiry just forces
-- needless re-auth. Drop the columns so the data layer cannot accidentally
-- re-introduce expiry checks.

ALTER TABLE mcp_tokens DROP COLUMN expires_at;
ALTER TABLE mcp_tokens DROP COLUMN refresh_expires_at;
