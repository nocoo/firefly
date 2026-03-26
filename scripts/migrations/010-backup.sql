-- 010-backup.sql
-- Add Backy remote backup integration columns to site_settings

ALTER TABLE site_settings ADD COLUMN backy_webhook_url TEXT DEFAULT '';
ALTER TABLE site_settings ADD COLUMN backy_api_key TEXT DEFAULT '';
ALTER TABLE site_settings ADD COLUMN backy_pull_key TEXT DEFAULT '';
