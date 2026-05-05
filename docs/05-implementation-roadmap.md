# 05 — Implementation Roadmap

## Guiding Principles

- TDD: Write tests before implementation
- Atomic commits: One logical change per commit
- Quality: Target Tier A (L1+L2+G1+D1 minimum)
- MVVM: Models testable without React

## Phase 0: Project Scaffolding

### 0.1 Initialize Next.js 16 + Bun workspace ✅

```
firefly/
├── package.json              ← Root with bun workspaces
├── src/
│   ├── app/                  ← Next.js App Router
│   ├── models/               ← Pure business logic
│   ├── hooks/                ← React hooks
│   ├── data/                 ← D1 data access
│   ├── services/             ← Service layer (orchestration, side effects)
│   ├── components/           ← UI components
│   ├── i18n/                 ← Internationalization
│   └── lib/                  ← Utilities
├── worker/                   ← Cloudflare Worker (D1 proxy)
├── scripts/migrations/       ← Migration scripts
├── docs/                     ← This documentation
├── e2e/                      ← E2E test scripts
└── public/                   ← Static assets
```

Commits:
1. ✅ `chore: initialize next.js 16 with bun and typescript strict` — Next.js 16.2.1, React 19
2. ✅ `chore: configure tailwind 4, eslint strict, vitest` — Tailwind CSS 4, ESLint 10 + typescript-eslint
3. `chore: setup husky pre-commit and pre-push hooks`
4. ✅ `chore: add shadcn/ui base components from basalt` — Button, Card, Input, cn(), design tokens

### 0.2 D1 Database Setup ✅

1. ✅ Create D1 databases: `firefly-db` (prod) — test DB removed, E2E uses local Miniflare
2. ✅ Write SQL migration files (`scripts/migrations/001-init.sql`)
3. ✅ Apply schema (`scripts/migrations/migrate.ts up`)
4. ✅ Deploy Worker D1 proxy (`worker/`, `firefly.worker.dev`)
5. ✅ Implement DB client (`src/lib/db.ts`) — 16 tests, 100% coverage

Commits:
1. `chore: create d1 databases and migration scripts`
2. `feat: implement d1 rest client with test isolation`
3. `test: verify d1 client against test database`

### 0.3 Auth Setup ✅

1. ✅ Configure Auth.js with Google OAuth
2. ✅ Implement email whitelist check
3. ✅ Add middleware route protection
4. ✅ Login page (basalt design)

Commits:
1. ✅ `feat: configure google oauth with auth.js` — Auth.js v5, Google provider, JWT strategy
2. ✅ `feat: add email whitelist and route guard middleware` — protect /admin/* and write APIs
3. ✅ `feat: implement login page with basalt design` — gradient blobs, Card, Google OAuth button
4. ✅ `test: add auth email whitelist unit tests` — 8 tests, auth-utils extracted

## Phase 1: Core Blog (Public)

### 1.1 Models & Data Layer ✅

Write models and data access for posts, categories, tags — all with tests first.

```
models/types.ts      ← Post, Category, Tag, Comment interfaces
models/post.ts       ← slugify, readingTime, excerptFromContent
models/markdown.ts   ← markdown → HTML rendering (server-side, marked)
data/posts.ts        ← CRUD queries
data/categories.ts   ← CRUD queries
data/tags.ts         ← CRUD queries
```

Commits (TDD — test first, then implementation):
1. ✅ `feat: add domain type definitions for all database entities`
2. ✅ `test: add post model unit tests`
3. ✅ `feat: implement post model (slugify, reading time, excerpt)` — 28 tests
4. ✅ `test: add markdown rendering tests`
5. ✅ `feat: implement markdown to html renderer` — 21 tests, marked
6. ✅ `test: add post data layer tests`
7. ✅ `feat: implement post CRUD data layer` — 15 tests
8. ✅ `test: add category and tag data layer tests`
9. ✅ `feat: implement category and tag CRUD` — 97 tests total

### 1.2 API Routes ✅

```
/api/posts            ← GET (list), POST (create)
/api/posts/[slug]     ← GET, PUT, DELETE
/api/categories       ← GET, POST
/api/categories/[slug]← GET, PUT, DELETE
/api/tags             ← GET, POST
/api/tags/[slug]      ← GET, PUT, DELETE
```

Commits:
1. ✅ `feat: implement post api routes` — includes all 6 endpoints + shared helpers

### 1.3 Public Pages (SSR) ✅

```
/                       ← Home (post list, paginated)
/YYYY/MM/slug           ← Post detail
/category/[slug]        ← Posts by category
/tag/[slug]             ← Posts by tag
/feed.xml               ← RSS feed
/sitemap.xml            ← Dynamic sitemap
/robots.txt             ← Bot directives
/llms.txt               ← AI crawler guide
```

Commits:
1. ✅ `feat: implement home page with post list`
2. ✅ `feat: implement post detail page with seo meta`
3. ✅ `feat: implement category and tag archive pages`
4. ✅ `feat: add rss feed, sitemap, robots.txt, llms.txt`
5. ✅ `feat: add structured data (json-ld) to all pages`
6. ✅ `feat: add dark mode with os preference detection`

### 1.4 Comments (read-only display) ✅

Display historical WordPress comments on post pages. No new comment submission.
Comments shown only on posts with `comment_enabled = 1`.

Commits:
1. ✅ `feat: implement comment display on post pages` — data layer + threaded display, 5 tests

### 1.5 Redirects ✅

Middleware to handle 301 redirects from WordPress URLs.

Commits:
1. ✅ `feat: implement 301 redirect middleware for wordpress urls` — with async hit counter

## Phase 2: Admin Panel

### 2.1 Admin Layout ✅

Based on basalt design system: sidebar navigation, top bar, responsive.

Commits:
1. ✅ `feat: implement admin layout with basalt design system` — sidebar, top bar, mobile overlay, dashboard page

### 2.2 Post Management ✅

List, create, edit, delete posts from admin panel.

Commits:
1. ✅ `feat: implement admin post list with search and filters` — paginated table, status/category/search filters
2. ✅ `feat: implement post create/edit form` — PostForm with markdown, tags, API tag_ids support
3. ✅ `feat: add markdown editor with live preview`
4. ✅ `feat: add image upload to r2 from editor` — R2 S3 client, upload API, drag-and-drop component, 18 tests
5. ✅ `feat: implement post delete with confirmation`

### 2.3 Category & Tag Management ✅

Commits:
1. ✅ `feat: implement admin category and tag crud` — reusable TaxonomyManager, inline create/edit/delete

### 2.4 Site Analytics Dashboard ✅

Track and display:
- Page views, unique visitors, sessions
- Bot traffic breakdown (search engines vs AI crawlers)
- Top posts, referrers, countries, devices
- Time-series charts (daily/weekly/monthly)

Commits:
1. ✅ `feat: implement page view tracking middleware` — fire-and-forget tracking, IP hashing, 9 tests
2. ✅ `feat: implement bot detection and classification`
3. ✅ `test: add analytics model and data layer tests`
4. ✅ `feat: implement analytics api routes` — overview, daily stats, top posts, referrers, devices, browsers, bots
5. ✅ `feat: implement analytics dashboard with charts` — recharts, area/pie/bar charts, period selector

## Phase 3: Data Migration ✅

Execute migration scripts in order (see doc 04).

Commits:
1. ✅ `feat: add wp data export script` — parse MySQL dump to JSON
2. ✅ `feat: add r2 image audit and sync scripts` — list R2 objects, directory summary
3. ✅ `feat: add post migration with content transform` — users, categories, tags, posts with image URL rewriting
4. ✅ `feat: add comment migration with parent remapping` — threaded parent-child remapping
5. ✅ `feat: add redirect generation from wordpress urls` — posts, categories, tags, writting→writing
6. ✅ `feat: add analytics seed migration` — IA data + post view_count fallback
7. ✅ `feat: add migration verification script` — count, integrity, and spot checks

## Phase 4: Launch

1. Deploy to Railway staging
2. Run full migration against prod D1
3. Verify all posts, images, redirects, analytics
4. Switch DNS from VPS → Railway
5. Monitor 301 redirects and error rates
6. Sunset WordPress after 30 days of stable operation

