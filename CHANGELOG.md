# Changelog

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
- fix: add lizheng.me HTTPS to next/image remote patterns
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
