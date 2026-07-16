# Changelog

## v2.8.0 (2026-07-16)

- Merge remote-tracking branch 'origin/main'
- fix(husky): close lockfile-only and JS E2E gate escapes
- fix(husky): serialize lint-staged and typecheck dep upgrades
- feat(lint): add gate:test-skip to block permanent .skip/.only in tests
- fix(admin): restore selection, palette scroll, analytics fetch, kbd a11y
- fix(build): register @/* webpack alias for TypeScript 7
- Merge pull request #296 from nocoo/agent/sde-02/6a293266
- chore(deps): bump wrangler 4.110.0 → 4.111.0 (worker)
- chore(deps): bump @cloudflare/workers-types 5.20260713.1 → 5.20260715.1 (worker)
- chore(deps): bump ai 7.0.26 → 7.0.29
- chore(deps): bump @aws-sdk/client-s3 3.1086.0 → 3.1088.0
- docs: record Biome migration and TypeScript 7 quality-gate changes
- feat(husky): run Biome, parallel G1 gates, and INDEX snapshot gates
- build(ts): upgrade to TypeScript 7.0.2 with Next native-preview marker
- feat(lint): add dynamic-delete and ts-expect-error custom gates
- chore(lint): switch from ESLint/typescript-eslint to Biome 2.5
- Merge pull request #288 from nocoo/agent/concierge/0f171328
- chore(deps): bump @aws-sdk/client-s3 3.1085.0 → 3.1086.0
- chore(deps): bump @cloudflare/workers-types 5.20260712.1 → 5.20260713.1 (worker)
- chore(deps): bump ai 7.0.22 → 7.0.26
- chore(deps): bump typescript-eslint 8.63.0 → 8.64.0
- Merge pull request #283 from nocoo/agent/sde-04/24585f87
- chore(deps): upgrade dependencies (batch 2026-07-13 patch/minor)
- Merge pull request #280 from nocoo/agent/sde-01/0b2b13e7
- chore(deps): bump @cloudflare/workers-types 5.20260710.1 → 5.20260711.1 (worker)
- Merge pull request #278 from nocoo/agent/sde-04/179fa159
- chore(deps): upgrade dependencies (batch 2026-07-11)
- Merge pull request #272 from nocoo/agent/sde-03/aafda391
- chore(deps): upgrade dependencies (batch 2026-07-10)
- Merge pull request #266 from nocoo/agent/sde-01/d8b52c2a
- chore(deps): upgrade dependencies (batch 2026-07-09)
- Merge pull request #259 from nocoo/agent/sde-02/a7d36e40
- chore(deps): upgrade dependencies (batch 2026-07-07)
- Merge pull request #249 from nocoo/agent/sde-03/360622eb
- chore(deps): bump @cloudflare/workers-types 5.20260704.1 -> 5.20260705.1
- Merge PR #247: chore(deps): upgrade dependencies (batch 2026-07-05)
- chore(deps): upgrade dependencies (batch 2026-07-05)
- Merge pull request #243 from nocoo/agent/sde-04/04e6150e
- chore(deps): bump @cloudflare/workers-types 4.20260702.1 -> 5.20260703.1
- Merge pull request #241 from nocoo/agent/sde-02/97a0ba15
- chore(deps): upgrade dependencies (batch 2026-07-03)
- Merge pull request #236 from nocoo/agent/sde-01/f6070c00
- chore: add root .npmrc for supply chain security baseline
- chore(deps): upgrade dependencies (batch 2026-07-02) (#235)
- Merge pull request #227 from nocoo/agent/sde-02/05502cf2
- chore(deps): upgrade dependencies (batch 2026-07-01)
- chore(deps): upgrade dependencies (batch 2026-06-30) (#219)


## v2.7.2 (2026-06-29)

- feat(ai): add authType (apiKey | bearer) for custom provider


## v2.7.1 (2026-06-29)

- chore(deps): bump @nocoo/next-ai ^0.3.0 -> ^0.4.0
- Merge pull request #212 from nocoo/agent/sde-04/cb625234-deps-batch
- chore(deps): bump @cloudflare/workers-types 4.20260626.1 -> 4.20260628.1
- chore(deps): bump lucide-react 1.21.0 -> 1.22.0
- chore(deps): bump ai 7.0.3 -> 7.0.4
- Merge pull request #207 from nocoo/agent/sde-04/21afbfb0-eslint
- Merge pull request #206 from nocoo/agent/sde-04/21afbfb0-ai
- Merge pull request #205 from nocoo/agent/sde-04/21afbfb0-workers-types
- chore(deps): bump eslint 10.5.0 -> 10.6.0
- chore(deps): bump ai 7.0.2 -> 7.0.3
- chore(deps): bump @cloudflare/workers-types 4.20260625.1 -> 4.20260626.1
- chore(deps): bump @nocoo/next-ai 0.2.1 -> 0.3.0 (ai 6 -> 7)
- Merge pull request #201 from nocoo/agent/sde-02/6e361e46
- deps: bump @cloudflare/workers-types to 4.20260625.1
- deps: bump wrangler to 4.105.0
- Merge pull request #197 from nocoo/agent/sde-01/0b96de8f
- deps: bump @types/node to 26.0.1
- deps: bump @cloudflare/workers-types to 4.20260624.1
- Merge pull request #194 from nocoo/agent/sde-04/62d1282a
- deps: bump wrangler to 4.104.0
- deps: bump @cloudflare/workers-types to 4.20260623.1
- deps: bump recharts to 3.9.0
- deps: bump hono to 4.12.27
- deps: bump ai to 6.0.209
- deps: bump @playwright/test to 1.61.1
- deps: bump @aws-sdk/client-s3 to 3.1075.0
- chore(deps): bump @aws-sdk/client-s3 and typescript-eslint (STU-1120) (#186)
- Merge pull request #183 from nocoo/agent/sde-02/6be4fcb9
- Merge pull request #182 from nocoo/agent/sde-01/29628c2f
- fix(auth): reject protocol-relative callbackUrl on login (STU-1102)
- fix(api): add in-route auth to media/[id] and posts/[slug] writes
- fix(proxy): exclude /api/* from skipStaticAssets dot shortcut
- Merge pull request #181 from nocoo/agent/sde-04/e21978e7
- chore(deps): bump @cloudflare/workers-types to 4.20260621.1
- Merge pull request #179 from nocoo/agent/sde-04/33a50629
- chore(deps): bump lint-staged 17.0.7 → 17.0.8
- chore(deps): bump @cloudflare/workers-types 4.20260619.1 → 4.20260620.1
- Merge pull request #176 from nocoo/agent/sde-03/60ecd11a
- chore(deps): bump @types/node 25.9.3 → 26.0.0 (MAJOR)
- chore(deps): bump hono 4.12.25 → 4.12.26
- chore(deps): bump lucide-react 1.20.0 → 1.21.0
- chore(deps): bump @aws-sdk/client-s3 3.1071.0 → 3.1073.0
- chore(deps): bump @cloudflare/workers-types 4.20260617.1 → 4.20260619.1
- chore(deps): bump sharp 0.35.1 → 0.35.2
- chore(security): bump wrangler to 4.103.0 to fix undici CVE
- Merge pull request #170 from nocoo/agent/sde-02/fff61c6a
- chore(ci): pin base-ci reusable workflow to v2026.5 SHA
- Merge pull request #164 from nocoo/agent/sde-04/88799df8
- fix(worker): use constant-time compare for Bearer auth
- Merge pull request #163 from nocoo/agent/sde-02/871d5e53
- chore(deps): bump @cloudflare/workers-types 4.20260616.1 → 4.20260617.1
- chore(deps): bump @aws-sdk/client-s3 3.1070.0 → 3.1071.0
- chore(deps): bump ai 6.0.207 → 6.0.208
- Merge pull request #158 from nocoo/agent/sde-01/467d91dd
- chore(deps): bump wrangler 4.100.0 → 4.101.0
- chore(deps): bump lucide-react 1.18.0 → 1.20.0
- chore(deps): bump ai 6.0.206 → 6.0.207
- chore(deps): bump @cloudflare/workers-types 4.20260615.1 → 4.20260616.1
- chore(deps): bump @aws-sdk/client-s3 3.1069.0 → 3.1070.0
- chore(deps): batch dependency upgrades 2026-06-16 (incl. 2 security) (#152)
- Merge pull request #140 from nocoo/agent/sde-03/5e512263
- chore(deps): bump ai 6.0.204 → 6.0.205
- test(e2e): split BDD Given and When comments in early admin/auth specs
- test(e2e): add BDD step comments to Phase 3 admin specs
- test(e2e): add BDD step comments to Phase 2 admin specs
- test(e2e): centralize BDD pathname helper
- Merge pull request #138 from nocoo/agent/sde-01/70e5fada
- chore(deps): bump @cloudflare/workers-types to 4.20260613.1
- test(e2e): close out L3 BDD migration to Stage 2 (final)
- test(e2e): migrate admin posts list/new/edit to BDD (Phase 3.4)
- test(e2e): migrate admin AI agents to BDD (Phase 3.3)
- test(e2e): migrate admin media + delete content-images to BDD (Phase 3.2)
- test(e2e): migrate admin taxonomy to BDD (Phase 3.1)
- test(e2e): migrate admin backup + MCP tokens to BDD (Phase 2.4)
- test(e2e): migrate admin settings to BDD (Phase 2.3)
- test(e2e): migrate admin dashboard + analytics smoke to BDD
- test(e2e): migrate login + admin auth guard to BDD
- test(e2e): migrate blog content/pagination/search/preview/lightbox to BDD
- test(e2e): migrate blog-taxonomy specs to BDD style
- test(e2e): migrate blog-reading specs to BDD style
- test(e2e): migrate SEO / RSS / image optimization specs to BDD style
- test(e2e): avoid content image seed deletion race
- test(e2e): disambiguate admin post edit tag label selector
- refactor(e2e): scaffold bdd fixtures and enable mixed testMatch for L3 migration
- docs: revise L3 BDD refactor plan per review
- docs: add L3 BDD refactor plan (25-l3-bdd-refactor.md)
- Merge pull request #136 from nocoo/fix/l3-coverage-gap
- test(e2e): cover archive index page in L3 specs
- test(e2e): cover admin post edit page in L3 specs
- test(e2e): cover blog post detail page in L3 specs
- Merge pull request #135 from nocoo/agent/sde-01/dfe3e848
- fix(mcp): remove inline semicolon from migration 017 comment
- fix(mcp): purge expiry wording from refresh error and design doc
- chore(mcp): remove expired status from admin UI and update design doc
- refactor(mcp): drop expires_in from token responses
- refactor(mcp): remove expiry checks from token data layer
- refactor(mcp): drop expires_at fields from McpToken type
- feat(mcp): add migration to drop token expiry columns
- Merge pull request #134 from nocoo/agent/sde-01/e7910b15
- chore(deps): bump tailwindcss 4.3.0 → 4.3.1
- chore(deps): bump lucide-react 1.17.0 → 1.18.0
- chore(deps): bump eslint 10.4.1 → 10.5.0
- chore(deps): bump ai 6.0.202 → 6.0.204
- chore(deps): bump @tailwindcss/postcss 4.3.0 → 4.3.1
- chore(deps): bump @aws-sdk/client-s3 3.1067.0 → 3.1068.0
- chore(deps): bump worker @cloudflare/workers-types 4.20260611.1 → 4.20260612.1
- chore(deps)(security): bump worker esbuild 0.27.3 → 0.28.1
- Merge pull request #125 from nocoo/agent/sde-01/91b1a394
- chore(deps): bump worker wrangler 4.99.0 → 4.100.0
- chore(deps): bump worker @cloudflare/workers-types 4.20260610.1 → 4.20260611.1
- chore(deps): bump sharp 0.34.5 → 0.35.1
- chore(deps): bump ai 6.0.200 → 6.0.202
- chore(deps): bump @aws-sdk/client-s3 3.1066.0 → 3.1067.0
- Merge pull request #119 from nocoo/agent/sde-01/be434e3e
- chore(deps): bump ai 6.0.199 → 6.0.200
- chore(deps): bump @types/node 25.9.2 → 25.9.3
- chore(deps): bump worker @cloudflare/workers-types 4.20260609.1 → 4.20260610.1
- chore(deps): bump @aws-sdk/client-s3 3.1065.0 → 3.1066.0
- Merge pull request #113 from nocoo/agent/sde-02/f1c58116
- chore(deps): bump worker wrangler 4.98.0 → 4.99.0
- chore(deps): bump next 16.2.8 → 16.2.9
- chore(deps): bump ai 6.0.198 → 6.0.199
- chore(deps): bump worker @cloudflare/workers-types 4.20260608.1 → 4.20260609.1
- chore(deps): bump @aws-sdk/client-s3 3.1064.0 → 3.1065.0


## v2.7.0 (2026-06-10)

- fix(layout): wrap next-themes ThemeProvider in client boundary
- docs(retro): record dev-mode CSP + HSTS regression
- fix(headers): only send HSTS in production to avoid dev https pinning
- fix(blog): / shortcut uses capture phase + e.code Slash fallback
- fix(blog): add bottom padding to .blog-main so footer doesn't crowd nav
- fix(csp): allow react-refresh eval in dev, keep production strict
- fix(b-06): /api/comments enforces published + commentsEnabled rule
- docs(24): record wave-4 completion (14 items, 15 commits)
- feat(blog): /archive index page with full-year heatmap
- feat(blog): archive year-page monthly heatmap
- feat(seo): use /api/og as OG image fallback in post metadata
- feat(seo): add /api/og route for dynamic OG cards
- feat(b-06): admin-only comment form + empty state copy
- feat(b-14): comment permalinks via #c-{id} anchor
- feat(blog): sticky article TOC with intersection observer
- feat(blog): code block copy button + language label
- feat(blog): reading progress bar on post detail
- fix(s-09): focus-visible uses blog-accent on .blog-shell surfaces
- fix(blog): inline code padding + footer inline styles to CSS classes
- fix(b-15): text-wrap balance on headings, pretty on paragraphs
- fix(blog): dim content images in dark mode
- fix(a-11): reject overlapping drops while a batch is uploading
- fix(a-12): allow CJK in slug validation to match slugify()
- docs(24): record wave-3 completion (12 items, 13 commits)
- refactor(s-07): migrate admin PAGE_TITLES to dictionary keys
- refactor(s-07): migrate theme-toggle + blog-footer strings to dictionary
- feat(s-07): add i18n dictionary scaffold with typed t() helper
- feat(a-11): per-file upload queue with status + dismiss
- refactor(a-15): extract filterCommandsByQuery to lib with tests
- feat(a-15): add navigation commands + grouping to CommandPalette
- fix(a-12): TaxonomyForm onBlur slug validation + helper
- fix(a-10): show spinner on PostForm save button while saving
- feat(s-01): bridge admin tokens to blog palette under .blog-shell
- feat(s-08): add print stylesheet for blog post pages
- refactor(s-03): slim globals.css down to entry + base + @imports
- refactor(s-03): split globals.css into 8 modular partials
- fix(post-form): mobile preview switches to write on focus + dual labels
- fix(form-field): label htmlFor follows the actual control id
- fix(post-form): focus visible textarea via useImperativeHandle
- fix(a11y): bind labels to controls in mcp / taxonomy / reference forms
- fix(post-form): wire content field aria + focus to actual textarea
- fix(form-field): inject id + aria-invalid + aria-describedby on child
- docs(24): record wave-2 completion (13 items, 14 commits)
- refactor(b-10): list pages use ListPageHeader for unified h1+meta
- feat(blog): ListPageHeader for category/tag/archive lists
- refactor(b-13): use FeaturedImage / shared sizes across 3 sites
- feat(blog): FeaturedImage component with shared sizes constant
- refactor(post-form): use FormField + Input for title/slug fields
- feat(ui): add FormField wrapper with label + description + error
- refactor(admin): use EmptyState in mcp-tokens and posts grid
- feat(b-12): add returning home action to list page empty states
- feat(ui): EmptyState with action slot and admin variant
- refactor(admin): use Input/Button primitives across forms
- refactor(admin): use Textarea in site-identity, ai-agent, reference
- refactor(post-form): use Textarea primitive in excerpt + content
- feat(ui): add Textarea primitive matching Input shape
- docs(24): record wave-1 completion (9 items, 12 commits)
- fix(a-02): show field-level errors in PostForm with auto-scroll
- feat(post-form): add inferErrorField for field-level error attribution
- fix(a-01): admin pagination shows ellipsis for many pages
- refactor(pagination): blog pagination uses shared buildPageSlots
- feat(pagination): extract shared buildPageSlots helper
- fix(b-02): wrap 404 page with blog shell + recent posts
- fix(a-13): replace emoji icons with lucide Sparkles/Paperclip
- fix(b-09): switch blog pagination active state to mono underline
- chore(b-04): drop unused .blog-byline-author class on slug page
- chore(b-04): drop unused .blog-byline-author class
- chore(s-11): drop legacy .blog-footer rules and unused breakpoint var
- fix(b-01): replace brand hover gradients with flat fills
- fix(s-04): add color-scheme for native form controls in dark mode


## v2.6.5 (2026-06-08)

- chore(deps): bump 4 major versions (lucide-react, marked, lint-staged, typescript)
- chore(deps): bump worker @cloudflare/workers-types 4.20260605.1 → 4.20260608.1
- chore(deps): bump 13 minor/patch dependencies


## v2.6.4 (2026-06-05)

- fix(security): bump vitest 3→4 in worker (#81)
- fix(security): bump wrangler in worker to fix transitive ws/brace-expansion CVEs (#80)
- fix(security): bump hono 4.12.19→4.12.23 (#79)
- fix(security): remove unsafe-eval from CSP script-src
- fix(test): replace setTimeout with vi.waitFor in auth tests
- Merge pull request #78 from nocoo/chore/next-16.2.7
- chore(deps): bump qs to 6.15.2 (GHSA-q8mj-m7cp-5q26)
- chore(deps): upgrade next to 16.2.7
- Merge pull request #71 from nocoo/fix/cve-deps
- fix: update brace-expansion and ws to fix CVEs


## v2.6.3 (2026-05-18)

- chore: stop tracking autoresearch.jsonl (ralph-loop local research log)
- Split McpTokensManager (242 LOC) into create-form + new-banner + confirm-dialogs
- Split AiSettingsForm (273 LOC) into provider-card + custom-card + form
- Cover e2e-local escapes-root throw via degenerate localDir='/' — 100% lines + funcs
- Cover analytics-human device map callback — functions 100% across codebase
- Cover markdown filenameFromUrl catch via out-of-range port — lines 99.87
- Cover markdown.ts OPTIMIZABLE_HOSTS catch branch — lines 99.81
- Cover unfurl-fetch abort-on-timeout callback — funcs 99.75
- Cover unfurl-github abort-on-timeout callback — funcs 99.51, lines 99.75
- Cover resolveLocalR2Path target===root branch — branches 99.51 (>99.5%)
- Cover IPv6 unspecified address (::) branch in validateUrl — branches 99.42
- Cover post-service statusChanged + tagIds/categoryChanged branches — branches 99.34
- Cover instrumentation register() idempotency guard — branches 99.18
- Cover instrumentation NODE_ENV=development branch (stubEnv) — branches 99.10
- Cover tracking.ts singleton cache-hit branch — branches 99.02 (>99%)
- Cover ai_agent_id mapping branch in mcp post entity — branches 98.93
- Cover undefined-args branches for getBySlug+delete in author-post — branches 98.77
- Cover db.ts non-Error fetch rejection branch — branches 98.61
- Cover listPosts aiAgentId filter branch — branches 98.53
- Cover orphan-reference auto-clear inner branches in updatePost — branches 98.45
- docs(autoresearch): summarize complexity refactor + coverage session
- test: cover server-only modules (e2e-local, backup.server) — coverage +1%
- Cover memoryHistory circular-buffer trim branch — branches 97.30
- Cover non-Error DNS rejection branch in resolveAndValidateHostname
- Cover rate-limit sweep partial-expiry branch — branches 97.14
- Cover updateLastUsed rejection swallow handler in validateMcpToken
- test: cover row-shaping callback in getAnalyticsDailyTrend
- Add db.call tests — lines 98.83, funcs 98.06
- Cover baseURL/sdkType in summarizeUnfurl — branches 97.06
- Cover undefined-args branches in author-post dataLayer — branches 96.90
- Cover baseURL/sdkType truthy branches in generateExcerpt — branches 96.73
- Add tests for getProviderConfig (services/ai.ts) — branches +0.16
- Decompose remaining non-JSX long functions (sitemap.xsl, backup/pull)
- Decompose PUT /api/settings (130) into parseSettingsBody + validators
- Decompose proxy() and createAuthorPostEntity into smaller helpers
- Split post-form.tsx (732) into 5 modules — all files now &lt;400 lines
- refactor(admin): split ai-agent-form.tsx (403) into avatar-uploader + form
- Split taxonomy-manager.tsx (410) into form + table + manager
- Split ai-agents-manager.tsx (452) into helpers + table + manager
- Split system-monitor-dashboard.tsx (454) into helpers + chart + dashboard
- Split site-identity-form.tsx (471) into logo + social + form
- Split backup-page.tsx (524) into helpers + push-card + pull-card
- Split mcp-tokens-manager.tsx (546) into setup-guide + table + manager
- Split media-library.tsx (679) into 6 modules; extract useMediaUpload hook
- Split unfurl.ts (468) into 6 modules; decompose fetchHtml + extractOgMetadata helpers
- refactor(analytics): split analytics.ts (785) into 6 modules
- Split admin-posts-client.tsx (849) into 6 cohesive component files
- Split post.ts (869) into 7 modules + barrel; decompose updatePost
- Baseline: 13 files over 400 lines, max 869 (post.ts), coverage 98.61%/96.44%/96.99%
- ci(security): bump base-ci to v2026.4 with extra-install-dirs=worker (Shai-Hulud defense)
- Merge pull request #69 from nocoo/fix/osv-fast-xml-builder
- chore(deps): add overrides for fast-xml-builder/fast-uri (GHSA-5wm8/45c6, GHSA-q3j6/v39h)
- Merge pull request #68 from nocoo/fix/upgrade-next-1626
- chore(deps): upgrade next to 16.2.6
- fix(deps): upgrade hono to 4.12.16+ (GHSA-69xw, GHSA-9vqf)
- chore(deps): override ip-address>=10.1.1 to fix GHSA-v2v4-37r5-5v8g
- docs: update test references from bun test to vitest
- fix(ci): restore e2e and worker vitest configs removed in error


## v2.6.2 (2026-05-05)

- fix: address review feedback — config cleanup, env visibility, SQL splitter
- fix: set R2_PUBLIC_URL per run mode and update stale roadmap refs
- chore: remove deprecated apply-migration.ts and stale README refs
- feat: add E2E-only R2 read route and fix image remote patterns
- refactor: extract local E2E helpers into shared module
- fix: use E2E_TEST_RUNNER flag instead of NODE_ENV for R2 adapter gate
- fix: strip PRAGMA and split batch SQL for local D1 (Miniflare compat)
- docs: update CI workflow and documentation for local E2E
- refactor: remove [env.test] and remote test resource dependencies
- refactor: rewrite E2E runner for fully local test infrastructure
- feat: add local filesystem R2 adapter for E2E testing
- test: raise coverage gate to 95%


## v2.6.1 (2026-05-03)

- fix(L3): use precise h1 selectors to avoid strict mode violations
- fix(L3): fix CI failures — strict h1 selector + year filter assertion
- docs: update L3 test count after deepening (139 → 158)
- test(L3): deepen taxonomy pagination — heading content on page 2
- test(L3): deepen RSS feed — item structure validation + URL format check
- test(L3): deepen admin media — year/mime filters + lightbox metadata panel
- test(L3): deepen admin taxonomy — create form toggle + edit form + post count
- test(L3): deepen pagination — current page indicator + previous page nav
- test(L3): deepen blog navigation — post card content + click navigation + archive
- test(L3): deepen tag page — post click navigation + noindex directive
- test(L3): deepen category page — post click navigation + card content
- docs: update quality system metrics to current state
- test(L3): add taxonomy and archive pagination browser E2E tests
- test(L3): add homepage pagination browser E2E tests
- test(L3): add tag page browser E2E tests
- test(L3): add category page browser E2E tests
- Merge pull request #67 from nocoo/fix/coverage-config
- chore: align coverage config with pew best practices
- chore: add lockfile sync check to pre-push hook
- chore: pin bun 1.3 via mise to fix Railway lockfile mismatch
- Merge pull request #66 from nocoo/deps/nextjs-16.2.4-65
- deps: upgrade next to 16.2.4
- docs(autoresearch): UT coverage optimization session
- perf(test): consolidate src+worker into single vitest run
- chore(test): emit worker coverage from root test:coverage
- test(noise): silence expected stderr in error-path cases
- test(coverage): pull pure logic back into coverage scope
- chore(test): run worker subpackage from root test scripts
- chore(husky): run worker unit tests in pre-push
- chore(deps): pin vitest and @vitest/coverage-v8 to 4.1.2
- fix(security): override postcss to >=8.5.10 for GHSA-qx2v-qp2m-jg93
- Merge pull request #64 from nocoo/fix/issue-63
- fix(ui): anchor collapsed sidebar logo to prevent jitter
- Merge pull request #62 from nocoo/fix/issue-61
- fix(ui): use rounded-card/rounded-widget utilities from theme tokens


## v2.6.0 (2026-04-23)

- fix(blog): keep backdrop and toggle interactive when drawer is open
- fix(blog): inert all page chrome outside drawer dialog
- fix(blog): true modal semantics for mobile drawer
- fix(blog): drawer scroll-lock leak + a11y + dead footer link
- feat(blog): mobile drawer for sidebar (collapsed by default ≤768px)
- style(blog): sidebar borders, footer prune, layout polish
- style(blog): sidebar/separator/footer micro-adjustments
- docs(blog): log round-2 redesign commits in tracking doc
- fix(blog): footer spans 100% viewport width
- style(blog): site title bigger, sidebar rhythm, full-bleed dividers
- fix(blog): hoist footer to .page-wrapper so it spans full 1500 width
- docs: finalize blog-redesign tracking doc with status + commit log
- feat(blog): rewrite footer as zed.dev 5-column with hatching watermark
- feat(blog): tighten post-card title (lg/xl + tracking-tight) — bleed already removed via CSS
- feat(blog): simplify layout client + restructure sidebar (lizheng pattern)
- feat(blog): wrap blog routes in .page-wrapper for 1500 max + edge ruler ticks
- feat(blog): inject IBM Plex fonts via next/font + update theme-color
- feat(blog): rewrite globals.css palette + decorative utilities (lizheng + zed)
- Merge pull request #60 from nocoo/fix/add-csp-header
- Merge pull request #56 from nocoo/fix/e2e-auth-bypass-guard
- fix(auth): use E2E_TEST_RUNNER guard instead of NODE_ENV check
- fix(security): add Content-Security-Policy header
- fix(security): add Content-Security-Policy header
- fix(auth): harden E2E bypass to reject production
- Merge pull request #59 from nocoo/fix/rate-limit-cross-instance-note
- docs(security): document in-memory rate limiter limitation
- Merge pull request #58 from nocoo/fix/mcp-register-auth
- Merge pull request #57 from nocoo/fix/mcp-token-rate-limit
- ci: upgrade base-ci to v2026.1
- fix(security): require auth for MCP client registration
- fix(security): add rate limiting to /api/mcp/token
- docs: update autoresearch ideas backlog
- Revert L2+L3 parallel; keep retries=1 \u2014 sequential safer
- Run L2 and L3 in parallel with playwright retries=1
- Skip rebuild when .next is fresh (mtime check)
- describe.concurrent across stateless L2 files
- Playwright: workers=10, fullyParallel
- Use turbopack for E2E build (5s faster than webpack)
- describe.concurrent for mcp.test.ts + maxWorkers=8
- Vitest projects: parallel L2 + serial racy files
- Build Next.js once for both API+browser servers
- Baseline: L1=1.03s, L2+L3=107.9s (build 2x + tests sequential)


## v2.5.17 (2026-04-20)

- fix(test): fix AI agents empty state detection in L3 test
- ci: restore workflow files and enable G2 security scanning
- test(L3): add comprehensive browser E2E tests for admin pages
- docs: add .env.example and quality system documentation
- ci: add parallel L2/L3/Worker jobs to GitHub Actions
- fix: enable E2E auth bypass for admin API routes and fix test issues
- test(e2e): add analytics source endpoint tests
- test(e2e): add system memory endpoint test
- test(e2e): add MD export endpoint tests
- test(e2e): add upload logo endpoint tests
- test(e2e): add MCP OAuth authorize and callback error path tests
- test(e2e): add unfurl enhance and favicon API tests
- test(e2e): add categories reorder endpoint test
- test(worker): enhance FTS tests for higher branch coverage
- test(worker): add Worker index tests
- test(e2e): add media years endpoint test
- test(e2e): add AI settings API tests
- test(e2e): add admin posts and search API tests
- test(e2e): add admin comments API test
- test(e2e): add admin AI agents API tests
- test(worker): add FTS module tests


## v2.5.16 (2026-04-20)

- fix: address issues from dependency cleanup commits
- chore: remove redundant ai dependency
- refactor: replace ulid with crypto.randomUUID()
- chore: remove custom LRU cache handler
- chore: remove unused hono and @hono/node-server dependencies


## v2.5.15 (2026-04-20)

- test(e2e): drop locale assertions and fix navigation race
- refactor(i18n): remove i18n framework, hardcode Chinese throughout


## v2.5.14 (2026-04-19)

- refactor(admin): replace dnd-kit category sorting with up/down buttons
- docs: remove KV cache migration doc (feature dropped)
- chore: remove unused kv-client module
- refactor(cache): drop KV cold storage, keep pure LRU
- fix(test): match nested node_modules in vitest exclude
- fix(cache): disable KV during build phase to prevent OOM
- chore: force Railway cache invalidation
- revert(cache): remove cacheHandler config to fix Railway OOM
- Revert "revert(deps): downgrade next 16.2.3 → 16.2.1 to fix Railway OOM"
- revert(deps): downgrade next 16.2.3 → 16.2.1 to fix Railway OOM
- fix(build): limit worker count with NEXT_WORKER_COUNT=2
- fix(build): use --webpack flag instead of --no-turbopack
- fix(build): disable Turbopack to reduce memory usage
- fix(build): limit static generation concurrency to 4 workers
- fix(build): set NODE_OPTIONS via nixpacks.toml
- fix(build): use node directly with max-old-space-size flag
- fix(build): increase Node.js heap memory for next build


## v2.5.13 (2026-04-19)

- test(cache): fix pure LRU mode tests with env KV config
- fix(instrumentation): throttle high memory warnings to once per 5 min
- feat(admin): show KV backend status in system monitor
- chore(eslint): ignore cache-handler.js build artifact
- docs(cache): mark KV cache migration as completed
- feat(cache): migrate to LRU + Cloudflare KV two-layer cache
- feat(lib): add KV client for Cloudflare REST API
- chore(deps): add lru-cache dependency
- docs(cache): fix optional chaining and clarify TTL behavior
- docs(cache): fix TTL consistency and code sync issues
- fix(deps): restore react-is required by recharts
- docs(cache): fix multi-instance and persistence issues
- docs(cache): fix KV migration plan design issues
- Merge pull request #50 from nocoo/feat/mcp-server-card
- feat(mcp): add MCP Server Card at /.well-known/mcp/server-card.json
- perf(tracking): use lazy singleton for tracking db
- docs: add KV cache migration plan document
- docs: add KV cache migration plan
- chore(deps): remove unused react-is dependency
- Add 60s in-process TTL cache for /feed.xml output
- fix(auth): allow E2E auth bypass in CI environment
- Baseline (fresh build): RSS after warmup + 20 request cycles
- fix(proxy): skip HTTPS redirect for localhost in production
- Baseline: RSS memory after warmup + 20 request cycles
- fix(e2e): add x-forwarded-proto header to bypass HTTPS redirect


## v2.5.12 (2026-04-19)

- fix(instrumentation): throttle high memory warnings to once per 5 min
- feat(admin): show KV backend status in system monitor
- chore(eslint): ignore cache-handler.js build artifact
- docs(cache): mark KV cache migration as completed
- feat(cache): migrate to LRU + Cloudflare KV two-layer cache
- feat(lib): add KV client for Cloudflare REST API
- chore(deps): add lru-cache dependency
- docs(cache): fix optional chaining and clarify TTL behavior
- docs(cache): fix TTL consistency and code sync issues
- fix(deps): restore react-is required by recharts
- docs(cache): fix multi-instance and persistence issues
- docs(cache): fix KV migration plan design issues
- Merge pull request #50 from nocoo/feat/mcp-server-card
- feat(mcp): add MCP Server Card at /.well-known/mcp/server-card.json
- perf(tracking): use lazy singleton for tracking db
- docs: add KV cache migration plan document
- docs: add KV cache migration plan
- chore(deps): remove unused react-is dependency
- Add 60s in-process TTL cache for /feed.xml output
- fix(auth): allow E2E auth bypass in CI environment
- Baseline (fresh build): RSS after warmup + 20 request cycles
- fix(proxy): skip HTTPS redirect for localhost in production
- Baseline: RSS memory after warmup + 20 request cycles
- fix(e2e): add x-forwarded-proto header to bypass HTTPS redirect


## v2.5.11 (2026-04-18)

- Merge pull request #39 from nocoo/feat/migrate-next-ai
- Merge pull request #49 from nocoo/fix/issue-44
- Merge pull request #48 from nocoo/fix/issue-43
- Merge pull request #47 from nocoo/fix/issue-42
- Merge pull request #46 from nocoo/fix/issue-41
- Merge pull request #45 from nocoo/fix/issue-40
- feat(proxy): rate-limit public API endpoints by client IP
- refactor(mcp): use isE2EMode helper for admin auth bypass
- refactor(admin): use isE2EMode helper for auth bypass check
- refactor(proxy): use isE2EMode helper for auth bypass checks
- feat(auth): add isE2EMode helper with production guard
- feat(lib): add sliding-window IP rate limiter
- feat(proxy): protect /api/admin GET routes
- fix(admin): sanitize FTS snippets in command palette
- feat(security): add security response headers
- fix(ui): align bg-card usage to B05 luminance spec
- feat: add homepage markdown rewrite in proxy
- feat: add homepage markdown API endpoint
- fix: q=0 extensions edge case and add proxy markdown tests
- fix: add Vary header and improve q=0 parsing
- fix: address review findings in markdown negotiation
- feat: add Accept text/markdown rewrite in proxy
- feat: add markdown API endpoint for blog posts
- feat: add OAuth Protected Resource Metadata (RFC 9728)
- fix: comply api-catalog with RFC 9727 linkset+json format
- feat: add RFC 8288 Link headers for agent discovery
- feat: add .well-known/api-catalog endpoint
- test(ai): update ai-service tests for next-ai migration
- refactor(ai): update consumers to use createAiModel from next-ai
- refactor(ai): remove reasoning fallback from generateExcerpt and summarizeUnfurl
- refactor(ai): migrate services/ai.ts to use @nocoo/next-ai
- feat(deps): add @nocoo/next-ai, remove redundant AI SDK deps
- Confirm stable test performance at ~1.1s
- Fix gist URL bug - exclude GitHub special paths from README fetch
- fix: remove tagPool memory leak, restore accurate estimateSize, fix DNS timeout test
- autoresearch: update docs for UT optimization session
- Replace DNS timeout test with fast mock - 6.10s → 1.13s
- Baseline: 1261 tests, 6.10s, 99%+ coverage
- autoresearch: update ideas and experiment log
- Unified cache storage (merge cache + metadata Maps)
- Add tag string interning in cache-handler - within noise
- Optimize estimateSize() to avoid JSON.stringify - within noise
- test: expand analytics coverage (91% → 95%+)
- test: boost ai-agent coverage to 100%
- test: add test-utils sqlContains coverage (66% → 100%)
- test: add status-colors coverage (0% → 100%)
- chore: remove stale Next.js CVE ignore (GHSA-5f7q-jpqc-wp7h)
- Merge pull request #36 from nocoo/feat/live-standard-35
- feat(api): upgrade /api/live to surety standard (#35)
- Merge pull request #34 from nocoo/feat/live-33
- feat(api): add /api/live liveness endpoint (#33)


## v2.5.10 (2026-04-16)

- deps: update hono 4.12.12→4.12.14, @modelcontextprotocol/sdk 1.27.1→1.29.0
- fix(data): wire aiAgentId through updatePost persistence layer
- feat(mcp): add optional ai_agent_id to full-scope post entity
- Merge pull request #32 from nocoo/fix/issue-25
- Merge pull request #31 from nocoo/fix/issue-24
- Merge pull request #30 from nocoo/fix/issue-23
- Merge pull request #29 from nocoo/fix/issue-22
- Merge pull request #28 from nocoo/fix/issue-21
- Merge pull request #27 from nocoo/fix/issue-20
- Merge pull request #26 from nocoo/fix/issue-19
- feat(ui): add standalone Skeleton base component
- fix(ui): SegmentedControl selected state bg-background → bg-card
- fix(ui): add hover border darkening to Input and Select
- style(sidebar): brand name font-bold + tracking-tighter
- style(shell): GitHub icon h-5 → h-[18px] per B02-2h
- fix(ui): remove shadow-sm from PostGridCard
- style(sidebar): nav group labels text-xs uppercase tracking-wider
- Merge pull request #18 from nocoo/fix/ai-agents-table-l2
- fix(ui): ai-agents table and empty state to L2 bg-secondary
- Merge pull request #17 from nocoo/fix/issue-16
- fix(ui): migrate L3 controls from bg-input to bg-secondary + border-border


## v2.5.9 (2026-04-14)

- fix(ui): replace raw select tags with Select component in MCP token manager
- fix(mcp): reject invalid scope on token creation instead of fail-open
- feat(mcp): add token scope management to admin UI


## v2.5.8 (2026-04-13)

- fix(design): correct hover interaction direction on delete comment button
- fix(design): unify modal backdrop style across command palette and sidebar
- Merge branch 'fix/babaco-design-layout' (PR #15)
- Merge branch 'fix/babaco-design-a11y' (PR #14)
- Merge branch 'fix/babaco-design-typography' (PR #13)
- Merge branch 'fix/babaco-design-color' (PR #12)
- fix(design): associate content label with textarea for accessibility
- fix(design): add aria-hidden to decorative brand icon in reference card
- fix(design): replace window.confirm/alert with ConfirmDialog and toast
- fix(design): replace remaining hardcoded colors with design tokens
- fix(design): use --header-height variable in post form preview calc()
- fix(design): use design tokens for success/error/warning states
- fix(design): add focus-visible ring to command palette search input
- fix(design): extract card image height to --card-thumb-height variable
- fix(design): extract STATUS_COLORS to shared module
- fix(design): add a11y to admin mobile sidebar — focus trap, ARIA dialog, inert background
- fix(design): register 1200px as --breakpoint-desktop custom theme token
- fix(design): replace non-standard font sizes and icon sizes with design tokens
- fix(design): replace bg-black with design tokens
- fix(design): extract sidebar width magic numbers to CSS variables


## v2.5.7 (2026-04-13)

- fix(ai-agent): clarify author_id requirement scope in prompt
- fix(mcp): restrict author tag access to list/get/create only
- feat(mcp): add tag CRUD tools to author scope


## v2.5.6 (2026-04-13)

- fix(post): auto-set published_at when status becomes published


## v2.5.5 (2026-04-13)

- fix(i18n): add missing translations for AI agent modal


## v2.5.4 (2026-04-13)

- fix(worker): support multi-statement SQL via DB.exec()
- docs: add retrospective for PRAGMA foreign_keys migration issue
- fix(migrations): add @batch mode for connection-level PRAGMA statements


## v2.5.3 (2026-04-13)

- fix(mcp): unify auth error messages for security


## v2.5.2 (2026-04-13)

- fix(mcp): migration FK safety, scope validation, accurate descriptions
- docs(prompt): clarify author_id is self-reported identity
- fix(mcp): add author_id to get/delete schemas and scope validation
- feat(mcp): unified OAuth auth with scope-based permissions
- feat(types): simplify AiAgent, add McpTokenScope type
- feat(db): add migration 016 for unified auth model
- docs: add defense-in-depth aiAgentId check and precise cross-agent behavior
- docs: fix agent permission descriptions to reflect ai_agent_id model
- feat(ci): add pre-push test DB schema check
- docs: add retrospective for DB migration before release


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
