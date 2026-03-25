# Changelog

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
