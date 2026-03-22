# 04 — Data Migration Plan

## Overview

Migrate WordPress MySQL → Cloudflare D1 SQLite. Run on local machine, not VPS.

**Source**: `ssh blog.nocoo.cloud` → MySQL `host_lizheng` (user: `wpuser`)
**Target**: Cloudflare D1 `firefly-db`

## Step 0: Export MySQL Dump

```bash
ssh blog.nocoo.cloud "mysqldump -u wpuser -p'<password>' host_lizheng \
  lizheng_posts lizheng_postmeta lizheng_terms lizheng_term_taxonomy \
  lizheng_term_relationships lizheng_comments lizheng_users \
  lizheng_independent_analytics_views lizheng_independent_analytics_visitors \
  lizheng_independent_analytics_sessions lizheng_independent_analytics_referrers \
  --no-create-info --complete-insert" > wp_data.sql
```

Better approach: Export as JSON via SQL queries for programmatic migration.

## Step 1: Image Audit (VPS vs R2)

**Critical**: Must verify every VPS attachment exists in R2 before going live.

### 1a. Export VPS file list with sizes

```bash
ssh blog.nocoo.cloud "find /var/www/html/wordpress/wp-content/uploads/ -type f \
  -exec stat -c '%n %s' {} \;" | \
  sed 's|/var/www/html/wordpress/||' | sort > vps_files.txt
```

### 1b. Export R2 file list with sizes

```bash
# Via CF API, paginate through all 2035 objects
# Script outputs: key, size, etag for each object
node scripts/migrations/list-r2-objects.ts > r2_files.txt
```

### 1c. Diff comparison

```bash
# Compare: files in VPS but not in R2 (need upload)
comm -23 <(cut -d' ' -f1 vps_files.txt | sort) <(cut -d' ' -f1 r2_files.txt | sort) > missing_in_r2.txt

# Compare: files in R2 but not in VPS (orphans, OK)
comm -13 <(cut -d' ' -f1 vps_files.txt | sort) <(cut -d' ' -f1 r2_files.txt | sort) > only_in_r2.txt

# Compare: size mismatches (corruption check)
# Join on filename, compare sizes
node scripts/migrations/compare-sizes.ts vps_files.txt r2_files.txt > size_mismatches.txt
```

### 1d. Upload missing files

```bash
# For each file in missing_in_r2.txt:
# scp from VPS → local → wrangler r2 object put
for file in $(cat missing_in_r2.txt); do
  scp blog.nocoo.cloud:/var/www/html/wordpress/$file /tmp/upload_staging/
  npx wrangler r2 object put lizhengblog/$file --file=/tmp/upload_staging/$(basename $file)
done
```

## Step 2: Migrate Users

Source: `lizheng_users` (1 row)

```sql
-- Extract
SELECT ID, user_login, user_email, display_name, user_registered
FROM lizheng_users;
-- Result: 1 | nocoo | lizheng@lizheng.me | nocoo | 2007-11-11
```

Map to `users` table. Google OAuth ID will be linked on first login.

## Step 3: Migrate Categories

Source: `lizheng_terms` + `lizheng_term_taxonomy` WHERE taxonomy='category' AND count > 0

```sql
SELECT t.term_id, t.name, t.slug, tt.count
FROM lizheng_terms t
JOIN lizheng_term_taxonomy tt ON t.term_id = tt.term_id
WHERE tt.taxonomy = 'category' AND tt.count > 0;
-- Result: 随笔(writting, 47), 流水账(diary, 25)
```

Note: WordPress has `writting` (typo) — decide whether to fix slug on migration.

## Step 4: Migrate Tags

Source: `lizheng_terms` + `lizheng_term_taxonomy` WHERE taxonomy='post_tag' AND count > 0

```sql
SELECT t.term_id, t.name, t.slug, tt.count
FROM lizheng_terms t
JOIN lizheng_term_taxonomy tt ON t.term_id = tt.term_id
WHERE tt.taxonomy = 'post_tag' AND tt.count > 0;
-- Result: 36 tags with posts
```

Discard ~170 tags with count=0.

## Step 5: Migrate Posts

Source: `lizheng_posts` WHERE post_type='post' AND post_status IN ('publish', 'draft', 'private')

### 5a. Content processing

For each post:
1. Extract markdown from `post_content` (WordPress stores HTML/Gutenberg blocks)
2. Convert WordPress HTML → clean Markdown (using turndown or similar)
3. Replace image URLs: `https://lizheng.me/wp-content/uploads/` → R2 custom domain URL
4. Set `wp_permalink` = `/index.php/YYYY/MM/slug/` for 301 redirect generation
5. Parse `post_date` for the `published_at` field
6. Generate reading time from content length

### 5b. Category assignment

```sql
SELECT tr.object_id as post_id, t.slug as category_slug
FROM lizheng_term_relationships tr
JOIN lizheng_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
JOIN lizheng_terms t ON tt.term_id = t.term_id
WHERE tt.taxonomy = 'category';
```

### 5c. Tag assignment

```sql
SELECT tr.object_id as post_id, t.slug as tag_slug
FROM lizheng_term_relationships tr
JOIN lizheng_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
JOIN lizheng_terms t ON tt.term_id = t.term_id
WHERE tt.taxonomy = 'post_tag';
```

### 5d. Featured image

```sql
SELECT p.ID as post_id, pm.meta_value as attachment_id
FROM lizheng_posts p
JOIN lizheng_postmeta pm ON p.ID = pm.post_id AND pm.meta_key = '_thumbnail_id'
WHERE p.post_type = 'post';
-- 50 posts have thumbnails
```

## Step 6: Migrate Comments

Source: `lizheng_comments` WHERE comment_approved='1'

```sql
SELECT comment_ID, comment_post_ID, comment_parent,
       comment_author, comment_author_email, comment_author_url,
       comment_content, comment_date
FROM lizheng_comments
WHERE comment_approved = '1'
ORDER BY comment_date;
-- 595 comments
```

Parent comment remapping: WordPress uses integer IDs for `comment_parent`.
Migration script must maintain wp_id → new_id mapping for threading.

## Step 7: Generate Redirects

For each published post, create redirect:
```
/index.php/YYYY/MM/slug/ → /YYYY/MM/slug
```

Also handle:
```
/index.php/category/writting/ → /category/writting
/index.php/category/diary/ → /category/diary
/index.php/tag/ai/ → /tag/ai
... (36 tags)
```

## Step 8: Migrate Analytics (seed data)

Source: `lizheng_independent_analytics_*` tables

Import as historical seed into `daily_stats` / `site_daily_stats`.
This is best-effort — exact mapping depends on IA schema analysis.

## Step 9: Migrate Attachments Metadata

Source: `lizheng_posts` WHERE post_type='attachment'

```sql
SELECT p.ID, p.post_title, p.post_name, p.post_mime_type, p.guid,
       pm1.meta_value as attached_file,
       pm2.meta_value as metadata
FROM lizheng_posts p
LEFT JOIN lizheng_postmeta pm1 ON p.ID = pm1.post_id AND pm1.meta_key = '_wp_attached_file'
LEFT JOIN lizheng_postmeta pm2 ON p.ID = pm2.post_id AND pm2.meta_key = '_wp_attachment_metadata'
WHERE p.post_type = 'attachment';
-- 990 attachments
```

Cross-reference with R2 audit (Step 1) to populate `attachments` table.

## Migration Script Architecture

```
scripts/migrations/
├── 00-export-wp-data.ts          ← SSH → MySQL → JSON export
├── 01-audit-r2-images.ts         ← VPS vs R2 file diff
├── 02-upload-missing-images.ts   ← Upload missing files to R2
├── 03-migrate-users.ts           ← Users → D1
├── 04-migrate-categories.ts      ← Categories → D1
├── 05-migrate-tags.ts            ← Tags → D1
├── 06-migrate-posts.ts           ← Posts + content transform → D1
├── 07-migrate-comments.ts        ← Comments with parent remapping → D1
├── 08-generate-redirects.ts      ← WordPress URLs → redirect table
├── 09-migrate-analytics.ts       ← IA data → daily_stats seed
├── 10-migrate-attachments.ts     ← Attachment metadata → D1
├── 11-verify-migration.ts        ← Count verification + spot checks
├── list-r2-objects.ts            ← R2 listing utility
└── compare-sizes.ts              ← File size comparison utility
```

Each script is idempotent (can re-run safely using `wp_id` as dedup key).

## Rollback Strategy

- D1 database can be dropped and recreated
- R2 files are additive (never delete during migration)
- WordPress remains untouched until new blog is verified
- DNS switch is the final step (only after full verification)
