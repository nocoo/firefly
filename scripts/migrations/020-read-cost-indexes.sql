-- Match the public listing's filter and ordering without sorting all posts.
CREATE INDEX IF NOT EXISTS idx_posts_status_published_created
ON posts(status, published_at DESC, created_at DESC);

-- Replace the boolean-only index: keep one index write per event while making
-- human/bot analytics use a time range instead of scanning all historical rows.
CREATE INDEX IF NOT EXISTS idx_page_views_bot_time
ON page_views(is_bot, viewed_at, bot_category);
DROP INDEX IF EXISTS idx_page_views_bot;
