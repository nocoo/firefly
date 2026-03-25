# Changelog

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
