-- Human authors: first-class humans table + posts.human_id.
-- Does not rebuild posts / ai_agents. Agent rows keep ai_agent_id and
-- leave human_id NULL.

CREATE TABLE IF NOT EXISTS humans (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  email           TEXT,
  profile_public  INTEGER NOT NULL DEFAULT 0 CHECK (profile_public IN (0, 1)),
  avatar_version  TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_humans_email
  ON humans(email) WHERE email IS NOT NULL;

ALTER TABLE posts
  ADD COLUMN human_id TEXT REFERENCES humans(id);

CREATE INDEX IF NOT EXISTS idx_posts_human ON posts(human_id);

ALTER TABLE site_settings
  ADD COLUMN default_human_id TEXT REFERENCES humans(id);

WITH seed AS MATERIALIZED (
  SELECT
    lower(hex(randomblob(16))) AS hid,
    COALESCE(NULLIF(trim(site_author), ''), NULLIF(trim(site_name), ''), 'Author') AS hname
  FROM site_settings
  WHERE id = 1
)
INSERT INTO humans (id, name, slug, email, profile_public, avatar_version, created_at, updated_at)
SELECT hid, hname, 'human-' || hid, NULL, 0, NULL, unixepoch(), unixepoch()
FROM seed
WHERE NOT EXISTS (SELECT 1 FROM humans);

UPDATE site_settings
SET default_human_id = (SELECT id FROM humans ORDER BY created_at ASC LIMIT 1)
WHERE id = 1 AND default_human_id IS NULL;

UPDATE posts
SET human_id = (SELECT default_human_id FROM site_settings WHERE id = 1)
WHERE ai_agent_id IS NULL AND human_id IS NULL;

DROP TABLE IF EXISTS _019_guard;
CREATE TABLE _019_guard (
  k TEXT PRIMARY KEY,
  v INTEGER NOT NULL CHECK (v = 1)
);
INSERT INTO _019_guard(k, v)
SELECT 'default',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM site_settings
      WHERE id = 1 AND default_human_id IS NOT NULL
    ) THEN 1 ELSE 0
  END;
INSERT INTO _019_guard(k, v)
SELECT 'xor',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM posts
      WHERE ai_agent_id IS NULL AND human_id IS NULL
    ) THEN 0 ELSE 1
  END;
INSERT INTO _019_guard(k, v)
SELECT 'fk',
  CASE
    WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check())
    THEN 0 ELSE 1
  END;
DROP TABLE _019_guard;

ALTER TABLE site_settings DROP COLUMN site_author;
