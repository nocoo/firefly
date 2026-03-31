# 01 — Project Overview & Migration Spec

## Vision

Firefly is a modern, high-performance blog platform replacing a WordPress installation
at `your-domain.com`. Goals: extreme performance, SEO-first, AI-crawler-friendly, clean
admin experience using the basalt design system.

## Source Analysis (WordPress)

### Content Inventory

| Data | Count | Migrate? | Notes |
|------|-------|----------|-------|
| Published posts | 72 | ✅ | 2007-05 ~ 2026-02, mix of diary + AI essays |
| Draft posts | 674 | ✅ | Mostly "北京这几天" diary series |
| Private posts | 1 | ✅ | Claude封号 article |
| Categories | 2 active | ✅ | 随笔(47), 流水账(25) |
| Categories (empty) | 3 | ❌ | 参考, 存档, 博物馆 — discard |
| Tags (with posts) | 36 | ✅ | AI(46), GPT-4o(25), Gemini(16), etc. |
| Tags (orphaned) | ~170 | ❌ | Nokia, jQuery, etc. — discard |
| Comments | 595 | ✅ | All approved, all ≤2012, threaded. Discard spam/pending during migration |
| Attachments (R2) | 2,035 files | ✅ | 529MB in `firefly` R2 bucket |
| Revisions | 2,429 | ❌ | WordPress revision history — discard |
| Analytics | 3,178 views | ✅ | Independent Analytics, 2025-05 ~ present |
| Users | 1 | ✅ | admin / admin@your-domain.com |

### WordPress Plugins — Disposition

| Plugin | Decision |
|--------|----------|
| Independent Analytics | Migrate view/visitor/session data as seed |
| WP Dark Mode | Rebuild natively (OS-preference based) |
| Offload Media (R2) | Files already in R2; replace URLs during migration |
| Featured Images RSS | Not needed |
| Disable Comments | Not needed (new comments not supported) |
| Enable Media Replace | Not needed |
| Loco Translate | Not needed |
| Redis Cache | Not needed (edge caching via CF/Railway) |
| BWG Photo Gallery | Empty data — discard |
| StatPress | Empty data — discard |
| Yoast SEO | Empty data — build SEO natively |

### WordPress Tables — Table Prefix `wp_`

Core tables to extract from:
- `wp_posts` — posts, pages, attachments, revisions
- `wp_postmeta` — thumbnail_id, view_count, etc.
- `wp_terms` + `wp_term_taxonomy` + `wp_term_relationships` — categories & tags
- `wp_comments` + `wp_commentmeta` — threaded comments
- `wp_users` — single user
- `wp_independent_analytics_*` — views, visitors, sessions, referrers, etc.

### URL Structure Migration

**WordPress (current):**
```
https://your-domain.com/index.php/YYYY/MM/slug/
https://your-domain.com/index.php/category/diary/
https://your-domain.com/index.php/tag/ai/
```

**Firefly (target):**
```
https://your-domain.com/YYYY/MM/slug        ← posts (date-prefixed for SEO continuity)
https://your-domain.com/category/diary
https://your-domain.com/tag/ai
```

301 redirects: `/index.php/YYYY/MM/slug/` → `/YYYY/MM/slug` (strip `index.php` and trailing slash).

### Image URL Migration

**Current in post_content:**
```
https://your-domain.com/wp-content/uploads/YYYY/MM/filename.ext
```

**R2 bucket key:**
```
wp-content/uploads/YYYY/MM/filename.ext
```

**Target (R2 custom domain):**
```
https://assets.your-domain.com/wp-content/uploads/YYYY/MM/filename.ext
```

During migration: keep R2 keys as-is (`wp-content/uploads/...`). Bind custom domain
`assets.your-domain.com` to R2 bucket, serving objects at their original keys.
Batch-replace `https://your-domain.com/wp-content/uploads/` →
`https://assets.your-domain.com/wp-content/uploads/` in post_content.

## Feature Scope

### Phase 1 — Core Blog (MVP)

- [x] Post CRUD (admin: create/edit/delete; public: list/read)
- [x] Category & Tag CRUD
- [x] Markdown editor with live preview (admin)
- [x] Single-user auth (Google OAuth, whitelist)
- [x] SEO: meta tags, Open Graph, structured data, sitemap.xml, robots.txt
- [x] AI-crawler support: llms.txt, proper bot handling
- [x] Dark mode (OS preference)
- [x] RSS feed
- [x] Image management via R2
- [x] 301 redirects from WordPress URLs
- [x] Comments (display historical only, no new comment submission)
- [x] Site analytics (visitor tracking, crawler/bot detection)

### Phase 2 — Enhanced

- [ ] Advanced markdown editor (rich toolbar, image upload/paste, table, code blocks)
- [ ] Full-text search
- [ ] Related posts
- [ ] Reading time estimation
- [ ] Table of contents generation
- [ ] AI summary per post
- [ ] Newsletter/subscription

### Out of Scope

- WordPress plugin system compatibility
- Multi-user / role-based access
- E-commerce / WooCommerce
- Photo gallery (BWG plugin was empty)
- Blogroll / links (table was empty)
