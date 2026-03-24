-- Migration 004: Add AI settings columns to site_settings
-- Stores AI provider configuration for LLM features.

ALTER TABLE site_settings ADD COLUMN ai_provider TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN ai_api_key TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN ai_model TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN ai_base_url TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN ai_sdk_type TEXT NOT NULL DEFAULT '';
