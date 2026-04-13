# Changelog

## v2.5.1 (2026-04-13)

- feat(blog): full opacity for author avatar/name in byline
- fix(api): add type validation before trim in ai-agents PATCH/POST routes
- docs(ai-agent): clean up outdated category-bound model references
- fix(api): normalize inputs before validation in ai-agents routes
- docs(ai-agent): update for ai_agent_id ownership model
- refactor(ai-agent): remove category-agent binding checks
- feat(ai-agent): block deletion when posts reference agent (soft delete)
- feat(data): add ai_agent_id to posts for direct agent authorship
- fix(ai-agent): improve MCP connection prompt and use correct SITE_URL
- fix(admin): localize edit button title in AI agents list
- feat(admin): add delete functionality for inactive AI agents
- fix(ui): use semantic color tokens in AI Agent components
- feat(design): add warning semantic color token


## v2.4.4 (2026-04-08)

- feat(admin): enhance posts list with tags, published date, and quick actions


## v2.4.3 (2026-04-08)

- fix(post): auto-set published_at when post is published but date is missing
- fix: remove useless constructor from MonitoredCacheHandler
- docs: update domain lizheng.me → lizheng.blog in CHANGELOG
- release: v2.4.1
- chore: move system monitor to overview section in sidebar
- fix: improve system monitor UX
- style: align system monitor cards with project design system
- fix: add i18n for system monitor and lazy init memory collection
- feat: add system monitor page with 48h memory/cache visualization
- feat: add system memory monitoring to admin dashboard


## v2.4.1 (2026-04-07)

- chore: move system monitor to overview section in sidebar
- fix: improve system monitor UX
- style: align system monitor cards with project design system
- fix: add i18n for system monitor and lazy init memory collection
- feat: add system monitor page with 48h memory/cache visualization
- feat: add system memory monitoring to admin dashboard


## v2.4.0 (2026-04-06)

- refactor: consolidate domain env vars into R2_PUBLIC_URL


## v2.3.2 (2026-04-06)

- chore(deps): upgrade next 16.2.2, vitest 4.1.2, vite 8.0.5 (security)
- feat(admin): add delete functionality for revoked MCP tokens


## v2.3.1 (2026-04-03)

- feat(analytics): replace bot lists with donut charts
- fix(analytics): device donut chart sizing and 2x2 layout
- fix(admin): dashboard cards use pure bg-secondary for L2 brightness
- refactor(admin): organize ai-settings-form into L2 cards per B-4/B-5
- refactor(admin): organize site-identity-form into L2 cards per B-4/B-5
- refactor(admin): organize settings-form into L2 cards per B-4/B-5
- fix(admin): textarea use bg-input per B-5 spec
- fix(admin): add bg-secondary to table containers per B-4 spec
- fix(ui): align interactive controls with B-5 color spec


## v2.3.0 (2026-03-31)

- fix: suppress Recharts width/height -1 warnings on initial render
- docs: add retrospective for filename normalization regression
- fix: revert filename normalization — preserve original display name in DB
- feat: add drag-and-drop upload to media library with filename normalization
- refactor: archive one-time migration scripts and scrub hardcoded domains
- chore: migrate CI to reusable bun-quality workflow
- fix: upgrade CI security tools (osv-scanner v2.3.5, gitleaks v8.30.1)
- chore: migrate ports 7043/17043/27043 → 7028/17028/27028


## v2.2.0 (2026-03-30)

- chore: update next-env.d.ts auto-generated type reference path
- fix: allow /api/favicon in robots.txt for search engine crawling
- refactor: dashboard two-column layout, stronger tabs, fix referrer empty rows
- fix: improve command palette contrast and move Visit Site under Dashboard
- feat: add global command palette search (Cmd+K) to admin
- fix: move search input back to above categories section
- fix: adjust search input position, width alignment, and clear button color
- chore: decommission fts-rebuild endpoint after production index built


## v2.1.0 (2026-03-30)

- docs: add FTS bug fix retrospectives to CLAUDE.md
- fix: sanitizeFtsQuery phrase/prefix support, fts-rebuild empty body, pagination validation
- docs: update FTS plan with implementation status
- test(e2e): add search API E2E tests
- feat(blog): add /search results page with pagination
- feat(blog): add SearchInput sidebar component
- feat(ui): add snippet prop to PostCard with safe HTML rendering
- feat(api): add dedicated GET /api/search endpoint
- test(data): add searchPosts, getPostRowid, and ftsSync unit tests
- feat(service): integrate FTS sync into PostService
- feat(data): add searchPosts() and getPostRowid() functions
- feat(lib): add Db.call() for custom Worker endpoints
- feat(worker): add FTS segmentation and search endpoints
- feat(db): add FTS5 search migration


## v2.0.4 (2026-03-29)

- fix: plug memory leaks in countCache, DNS timer, and React timers
- docs: fix search pagination to extend Pagination with searchParams prop
- test: improve branch coverage to 92% (comment, taxonomy-routes, MCP post)
- docs: refine full-text search design (FTS5 stored mode, Db.call, native search form)
- chore: bump version to 2.0.3
- fix: add aria-sort attribute to sortable table headers
- feat: apply fade-up animation to dashboard stat cards
- feat: add font-display utility and fade-up animation
- feat: add Badge component with semantic variants
- fix: update card layers to use bg-secondary without border/shadow
- feat: show comments section with admin delete on post edit page
- chore: bump version to 2.0.2
- feat: add sortable columns to admin posts table and comment delete for admins
- fix: move DndContext outside table to prevent hydration error
- fix: batch accessibility and UI review fixes across blog components
- refactor: replace pagination guillemets with Lucide chevron icons
- fix: use theme token for sidebar heading icon color
- refactor: convert social-link hover to pure CSS
- fix: hide keyboard shortcut hints on mobile
- perf: add lazy loading to reference card images
- feat: add smooth scroll with reduced-motion respect
- fix: remove redundant link wrapping on post excerpt
- feat: add separators between sidebar sections for visual rhythm
- feat: enrich blog footer with RSS link and back-to-top button
- feat: enrich empty states with contextual icons
- fix: override IconButton admin tokens inside blog shell
- feat: add subtle fade-in animation to blog main content
- refactor: replace padding-bottom hack with aspect-ratio for featured images
- fix: enlarge touch targets in global bar and drawer close
- fix: add ARIA dialog semantics to mobile drawer
- refactor: extract taxonomy slug route helpers to deduplicate [slug] handlers
- fix: align TaxonomyConfig generics and add explicit callback types
- refactor: extract taxonomy factory to deduplicate tag/category CRUD
- refactor: fix category route type drift and deduplicate R2 upload
- refactor: remove dead analytics functions, unused exports, and unify timestamps
- fix: sync worker lockfile name and fix remaining doc inaccuracies
- docs: renumber all docs, archive superseded, remove unused dep
- refactor: remove dead redirects module and unused admin components
- docs: sync README, architecture, and media docs with actual codebase
- refactor: remove dead BaseDataLayer abstraction
- chore: unify package manager to bun, remove pnpm/npm lockfiles
- docs: add full-text search design doc (21-full-text-search.md)
- fix: osv-scanner lockfile path (bun.lock → pnpm-lock.yaml)


## v2.0.1 (2026-03-28)

- Disable Next.js Link prefetch on all blog frontend routes
- refactor: consolidate worker-v2 into worker, deploy as firefly


## v2.0.0 (2026-03-28)

- chore: update next-env.d.ts for Next.js dev types path
- fix(mcp): wire post writes to PostService, fix afterUpdate contract
- fix(e2e): make excerpt test resilient to AI provider being configured
- docs: mark Stage 4 complete, add architecture section to CLAUDE.md
- refactor(tests): consolidate createMockDb to single source in @/data/core/test-utils
- refactor(mcp): remove rollback hooks, simplify to best-effort afterCreate/afterUpdate
- fix(media): wire API write routes to MediaService for correct fault semantics
- docs: mark Stage 3 complete in entity data layer plan
- refactor(media): migrate all consumers to @/data/entities/media, delete old media.ts
- refactor(posts): migrate all consumers to @/data/entities/post + PostService, delete old posts.ts
- refactor(comments): migrate consumer to @/data/entities/comment, delete old comments.ts
- refactor(categories): migrate all consumers to @/data/entities/category, delete old categories.ts
- refactor(tags): migrate all consumers to @/data/entities/tag, delete old tags.ts
- fix(e2e): strict health check for Worker readiness; align worker-v2 version
- chore(worker-v2): configure production D1 binding and custom domain
- docs: mark Stage 2 complete in entity data layer plan
- fix(migrations): update WorkerHttpAdapter paths to /api/v1/*
- chore(e2e): point E2E runner at worker-v2
- refactor(db): update API paths from /api/* to /api/v1/*
- feat(worker-v2): add new Worker project with /api/v1/* endpoints
- fix: address Stage 1 review findings
- docs: mark Stage 1 as complete in entity data layer plan
- refactor(data): adopt buildSetClauses in settings and ai-settings
- feat(services): add MediaService with R2+DB orchestration
- feat(services): add PostService with best-effort orchestration
- feat(data): add Media entity with CRUD, batch ops, and year listing
- feat(data): add Post entity with CRUD, tags, batch ops, and aggregations
- feat(data): add Comment entity with listCommentsByPost and buildCommentTree
- feat(data): add Category entity with cache, reorder, and post stats
- feat(data): add Tag entity with cache support
- feat(data): add BaseDataLayer with viewQuery support
- feat(data): add EntityCacheManager with 100% coverage
- feat(data): add timestamps utility with 100% coverage
- fix(data): use unknown instead of eslint-disable for customList options
- feat(data): add core types, SQL utilities, and test-utils for entity data layer
- docs(20): fix media/associate boundary mapping — already uses postId
- docs(20): fix media route gap, archive cache semantics, admin posts boundary
- docs(20): complete D5 boundary mapping for Post/Media + MediaService D6 contract
- docs(20): add tableAlias for viewQuery and multi-column defaultOrderBy
- docs(20): fix D5 boundary mapping and add refreshAllCategoryPostCounts
- docs: add entity data layer refactoring design (doc 20)
- feat(admin): dynamic year filter with counts for posts list


## v1.7.7 (2026-03-27)

- feat(media): dynamic year filter with counts and file type icons
- fix: add attachment backfill script to correct media library dates
- docs: replace lizheng.blog references with generic placeholders
- refactor: replace lizheng.blog hardcoded instances with env vars


## v1.7.6 (2026-03-27)

- style: add icons to continue reading button and post byline


## v1.7.5 (2026-03-27)

- fix: auto-save AI excerpt to post in generate_excerpt MCP tool


## v1.7.4 (2026-03-27)

- chore: add project CLAUDE.md with retrospective
- fix: balance EXCERPT_PROMPT between SEO and reader engagement
- fix: rewrite EXCERPT_PROMPT for teaser-style summaries


## v1.7.3 (2026-03-27)

- chore: add tsbuildinfo to gitignore
- refactor: unify AI excerpt prompts with author-first-person style


## v1.7.2 (2026-03-27)

- chore: update auto-generated type files
- fix: use postTitle + filename as image alt fallback
- fix: ensure all images have alt attribute, add title support


## v1.7.1 (2026-03-27)

- chore: update auto-generated type files
- feat: add published_at date picker to post editor
- feat: sort admin post list by created_at DESC
- feat: add drag-and-drop category reordering in admin
- feat: add batch reorder API for categories
- feat: change category sort order to DESC and set default ranking


## v1.7.0 (2026-03-27)

- chore: update auto-generated type files
- perf: add fetchPriority="high" to featured images on post pages
- fix: add accessible names to social links and read-more links
- fix: resolve ArticleNav hydration mismatch with useSyncExternalStore
- docs: mark doc 19 (image optimization) as complete
- test: add E2E tests for image optimization and content lightbox
- perf: use next/image for admin media grid thumbnails
- feat: enable optimized image rendering on blog post and preview pages
- refactor: use ImageLightbox in admin media library
- feat: add click-to-preview lightbox for blog content images
- feat: add shared ImageLightbox component
- feat: add optimizeImages option to renderMarkdown for next/image proxy
- docs: fix E2E test count in commit 7 scope (1-7 → 1-8)
- docs: revise doc 19 — fix three review issues in lightbox design
- docs: add design doc 19 — image optimization and content lightbox
- feat: add image preview lightbox to media library
- feat: responsive media grid with 16-column desktop layout and hover overlay
- feat: add filters and sorting to media library
- fix: remove parentheses from archive counts in sidebar for consistency
- feat: add icons to sidebar section headings
- feat: add lucide icons to post byline and fix edit button alignment
- feat: replace GitHub link with admin dashboard button in global bar


## v1.6.1 (2026-03-27)

- chore: add edit-post-subtitle component and update gitignore
- refactor: migrate admin page titles to centralized subtitle context
- fix: repair E2E test suite for full L2+L3 green
- Merge remote-tracking branch 'origin/main'
- fix: eliminate preload/upload race condition in PostForm media list
- fix: show toast error on media association failure instead of swallowing
- fix: remove redundant auth() from media routes, use proxy protection
- Merge pull request #6 from nocoo/worktree-mcp-explore
- docs: mark media library document as implemented
- test: add L2 E2E tests for media API endpoints
- feat: add R2 to DB sync script for initial media library population
- fix: suppress eslint ignored-file warning in lint-staged
- feat: add media link to admin sidebar and i18n keys
- feat: add media library page with grid view and pagination
- feat: upgrade image upload zone to support continuous uploads
- fix(mcp): harden tests and bump version for schema change
- feat: add media API routes for list, create, and delete
- feat: add media data access layer with CRUD operations
- docs: mark all 11 atomic commits as complete in doc 17
- feat: add post_id column and indexes to attachments table
- test(e2e): add E2E tests for ID lookup, conflict rejection, and field projection
- refactor(mcp): delete old hand-written tools/ directory
- refactor(mcp): replace hand-written tool registration with entity-driven framework
- feat(mcp): add post entity definition with hooks, projection, and extras
- feat(mcp): add category entity definition with tests
- feat(mcp): add registration engine + tag entity definition
- feat(mcp): add generic CRUD handler factory with tests
- feat(mcp): add framework core with tests — types, resolve, response, projection
- docs: add entity-driven MCP framework design (doc 17)
- fix: point E2E to lizhengblog-test R2 bucket
- docs: finalize quality hardening with verification results
- feat: add L2 E2E test for upload endpoint
- feat: add R2 test bucket binding for upload isolation
- feat: add GitHub Actions CI for G1+L1+G2 quality gates
- chore: add .gitleaks.toml with project-specific allowlist
- perf: add lint-staged for incremental pre-commit linting
- perf: move coverage enforcement from pre-commit to pre-push


## v1.5.0 (2026-03-26)

- feat(backup): add Backy remote backup integration — admin page, push/pull webhooks, config & test API, history, data export
- feat: add unique visitors card and top cities chart to analytics
- feat: improve stat cards with period label and real delta values
- feat(admin): redesign post editor layout with 3-column structure
- feat(blog): add admin-only edit button to post byline
- feat(i18n): add translation keys for post edit/view buttons
- fix(admin): remove duplicate article title from edit page header
- fix(admin): align preview panel top/bottom with left-side form
- fix(backup): allow API key omission on update, add fetch timeouts, fix epoch 0
- fix: classify Sogou and Yisou spiders as search engine bots
- refactor: remove duplicate AggregatesPanel from analytics dashboard


## v1.4.0 (2026-03-26)

- chore: update tsbuildinfo
- feat: add tag filter to posts page and "View All" button to taxonomy manager
- feat: add multi-select bulk edit for posts (status and category)
- refactor: replace native confirm/alert with ConfirmDialog and toast
- feat: add Sonner toast, Radix AlertDialog, and ConfirmDialog components
- feat: enhance post search with keyboard shortcut, wider matching, and date filters
- fix: add lizheng.blog HTTPS to next/image remote patterns
- fix: resolve picomatch CVE, E2E next build+start, skip HTTPS in test
- fix: E2E uses next build+start, skip HTTPS redirect in test mode


## v1.3.0 (2026-03-25)

- chore: update tsbuildinfo
- feat: blog UX improvements — localization, navigation, theming


## v1.2.2 (2026-03-25)

- chore: update tsbuildinfo
- fix: redirect HTTP to HTTPS via x-forwarded-proto in proxy


## v1.2.1 (2026-03-25)

- fix: sync preview theme with global dark mode on mount
- fix: use fixed dark foreground on grid card hover buttons for dark mode visibility
- refactor: merge analytics into dashboard page


## v1.2.0 (2026-03-25)

- Merge pull request #4 from nocoo/violet-waxflower
- merge: resolve conflicts with main (analytics + reference-url coexist)
- refactor: split unfurl into two-step flow with optional AI enhancement
- fix: switch unfurl AI to JSON output format, drop reasoning fallback
- test: add success path and method check to unfurl E2E
- test: add success path and method check to unfurl E2E
- fix: clear orphan reference metadata when URL is emptied
- fix: handle quoted OG content and resolve relative og:image URLs
- fix: add DNS resolution to SSRF protection in unfurl service
- test: update MCP E2E to expect 17 tools after unfurl_reference
- test: add unit and E2E tests for reference URL feature
- feat: add unfurl_reference MCP tool
- feat: add ReferenceCard component and blog display
- feat: add reference URL editor section to post form
- feat: add /api/unfurl endpoint with graceful AI fallback
- feat: add AI summarization for unfurled metadata
- feat: add URL unfurl service with SSRF protection
- feat: add reference URL columns migration and data layer
- docs: add 14-reference-url feature spec


## v1.1.0 (2026-03-25)

- fix: mock SITE_URL in sitemap and feed tests to isolate from .env
- fix: handle null return from execSync with inherited stdio in release script
- fix: aggregate referrers by hostname instead of full URL to eliminate duplicates
- fix: prevent recharts negative dimension warning with minWidth/minHeight defaults
- style: apply pew chart styling to aggregates panel and remove dead chart helpers
- style: apply pew chart styling to search and AI bot timeline charts
- style: apply pew chart styling to human tab charts
- style: apply pew chart styling to traffic trend area chart
- refactor: overhaul chart-helpers with pew-style palette and formatters
- style: add chart-axis/chart-muted CSS vars and recharts focus fix
- test: strengthen analytics E2E coverage with period, delta, and schema tests
- fix: add clickable links for article pages in search and AI bot tabs
- fix: await view_count UPDATE to reduce drift within fire-and-forget tracking
- fix: show NEW instead of — when previous period has zero data
- fix: add is_bot=1 to search/ai source conditions for strict mutual exclusivity
- fix: re-fetch active tab instead of hardcoded human on period change
- fix: prevent date key from being overwritten by numeric 0 in timeline data
- docs: mark analytics redesign as complete in README
- docs: mark all analytics redesign commits as complete
- feat: rewrite analytics dashboard with four-source tabs and i18n
- feat: add shared chart helpers and summary-level analytics components
- feat: add /api/analytics/source detail endpoint
- feat: rewrite /api/analytics as four-source summary endpoint
- feat: add analytics summary + source query functions
- feat: increment posts.view_count on human page view
- feat: resolve post_id from path in tracking
- fix: protect analytics GET endpoints with admin auth
- chore: update next-env.d.ts type reference path
- fix: read cf-ipcity header in proxy for city-level geo tracking
- docs: add analytics dashboard redesign design document
- fix: translate taxonomy page headers, show post stats, and restyle action buttons
- feat: add i18n keys for taxonomy page titles and post stats
- feat: add listCategoriesWithPostStats query for admin category page
- fix: revert GET handler to 405 — SSE transport not supported
- fix: support GET/SSE connections on MCP endpoint
- fix: allow desktop/IDE client Origin headers in MCP endpoint
- fix: resolve MCP OAuth login failure with Auth.js v5
- refactor: rename /admin/mcp-tokens to /admin/mcp
- feat: add MCP setup guide to admin tokens page
- fix: add revalidate=300 to root layout and description fallback


## v1.0.0 (2026-03-25)

Version management upgrade — centralized version infrastructure.

### Changes

- **Version SSOT** — `package.json` version injected at build time via `NEXT_PUBLIC_APP_VERSION`
- **Version module** — New `src/lib/version.ts` as the single import point for all version consumers
- **Sidebar pill** — Dynamic version display with monospace font (`v1.0.0`)
- **Health endpoint** — New `GET /api/live` returning `{ status, version, timestamp }`
- **MCP server** — Version now reads from centralized module instead of hardcoded string
- **Release automation** — New `scripts/release.ts` supporting patch/minor/major/exact/dry-run

## v0.2.0 (2026-03-24)

First public release of Firefly — a Next.js 16 blog platform backed by Cloudflare D1.

### Features

- **Core blog** — Post CRUD, categories, tags, comments, RSS/Atom feed, sitemap, structured data (JSON-LD)
- **Admin panel** — Post editor with live Markdown preview, category/tag management, image upload to R2
- **Analytics** — Page view tracking, bot detection, device classification, dashboard with charts
- **i18n** — English and Chinese with DB-backed locale setting
- **AI excerpt generation** — One-click AI-powered summaries via multi-provider AI infrastructure (Anthropic, MiniMax, GLM, AIHubMix, custom)
- **AI settings** — Admin UI for configuring AI provider, model, API key, with connection test
- **Typography** — Heti-inspired CJK typography with 4 font style presets (PingFang, Classic, Serif, Sans)
- **SEO** — Full meta tags, Open Graph, Twitter Cards, robots.txt, llms.txt, styled sitemap
- **Performance** — TTL caching, pre-rendered Markdown HTML, lazy-loaded comments, optimized images
- **Responsive design** — 3-tier responsive layout for blog and admin
- **Theme** — Dark mode with system preference detection via next-themes
- **Auth** — Google OAuth with email whitelist
- **Settings** — Site language, posts per page, comments toggle, font style
- **Migration system** — Custom DB migration tool with tracking, multi-target support (local/test/prod)
- **WordPress migration** — Data export, content transform, comment remapping, redirect generation, R2 image sync
- **Logo pipeline** — Single-source SVG with automated derivative generation

### Quality

- 290 unit tests (L1)
- 33 API E2E tests (L2)
- Browser E2E tests (L3)
- TypeScript strict, ESLint strict with zero warnings (G1)
- Security gate: osv-scanner + gitleaks (G2)
- Husky hooks: pre-commit (L1 + G1), pre-push (L2 + G2)
