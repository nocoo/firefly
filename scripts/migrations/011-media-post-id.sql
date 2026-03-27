-- 011: Add post_id and created_at index to attachments for media library
ALTER TABLE attachments ADD COLUMN post_id TEXT REFERENCES posts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_post_id ON attachments(post_id);
CREATE INDEX IF NOT EXISTS idx_attachments_created_at ON attachments(created_at);
