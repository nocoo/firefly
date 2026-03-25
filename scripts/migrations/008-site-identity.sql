-- 008: Add site identity columns to site_settings
-- These fields allow each Firefly instance to customize its public identity
-- instead of relying on hardcoded values in source code.

ALTER TABLE site_settings ADD COLUMN site_name TEXT NOT NULL DEFAULT 'My Blog';
ALTER TABLE site_settings ADD COLUMN site_tagline TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN site_description TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN site_author TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN author_email TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN twitter_handle TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN social_links TEXT NOT NULL DEFAULT '[]';
