-- 006: Add site logo version to site_settings
-- The version string points to a versioned R2 path:
-- firefly/wp-content/uploads/firefly/site/<version>/logo-{size}.png
-- NULL means no custom logo (fall back to static assets).

ALTER TABLE site_settings ADD COLUMN site_logo_version TEXT DEFAULT NULL;
