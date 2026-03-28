# Firefly

Personal blog platform built with Next.js + Cloudflare Workers.

## Architecture

### Data Layer
- `src/data/core/` — Base data layer framework (sql builder, cache manager, timestamps)
- `src/data/entities/` — Pure CRUD entity modules (post, tag, category, comment, media). camelCase input types, snake_case DB columns.
- `src/services/` — Service layer for orchestration with side effects (PostService, MediaService). Best-effort secondary effects (D6 contract: primary throws, secondary logs).
- `src/data/` (root) — Non-entity data modules (analytics, settings, backup, mcp-tokens, etc.)

### MCP Framework
- `src/lib/mcp/framework/` — Generic entity-driven MCP tool framework (handlers, projection, resolve, register)
- `src/lib/mcp/entities/` — Entity configs (post, tag, category) with hooks for snake_case→camelCase mapping
- Hooks: `afterGet`, `afterCreate` (best-effort), `afterUpdate` (best-effort), `mapCreateInput`, `mapUpdateInput`
- No rollback mechanisms — all post-write hooks are best-effort (log on failure, don't roll back)

### Key Conventions
- Entity inputs: camelCase (`categoryId`, `featuredImage`, `publishedAt`)
- DB columns: snake_case (`category_id`, `featured_image`, `published_at`)
- MCP/REST external API: snake_case fields, mapped at boundary via hooks/route handlers
- Test mock: `createMockDb()` from `@/data/core/test-utils` (single source, no local copies)

## Retrospective

### 2026-03-27: tsconfig.tsbuildinfo 导致 release 脚本失败
**问题**: `bun run release` 报 "Working tree is dirty"，原因是 `tsconfig.tsbuildinfo` 被 git 跟踪但每次 build 都会变更。
**修复**: 将 `*.tsbuildinfo` 加入 `.gitignore` 并 `git rm --cached` 移除跟踪。
**教训**: 构建产物不应被 git 跟踪，新项目初始化时应确保 `.gitignore` 覆盖所有构建缓存文件。
