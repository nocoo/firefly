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

### 2026-03-30: FTS sanitizeFtsQuery 未处理 segmentText 的副作用
**问题**: `sanitizeFtsQuery()` 先调用 `segmentText()`，但 `Intl.Segmenter` 的 `isWordLike` 过滤器会丢弃 `"` 和 `*` 字符，导致引号短语查询和前缀通配符在进入 token 处理前就被吃掉了。
**修复**: 在调用 `segmentText()` 之前，用正则提取引号包裹的短语和尾部 `*`，分别处理后再拼装。
**教训**: 当一个纯函数（segmentText）被复用于不同上下文（索引写入 vs 查询构建）时，它的过滤行为可能与下游假设冲突。写入端只需 word tokens，但查询端需要保留语法符号。复用前要验证过滤器是否吃掉了下游需要的信息。

### 2026-03-30: Worker 路由统一解析 JSON body 导致无 body 端点 400
**问题**: `fts-rebuild` 设计为无 body 的 POST 端点，但 Worker 路由先统一调用 `parseJsonBody()`，空 body 解析失败直接返回 400。
**修复**: 将 `fts-rebuild` 路由提到 JSON body 解析之前。
**教训**: 给路由添加统一 middleware 时，要审查每个端点是否都需要该 middleware 的前置条件（如 JSON body）。不需要 body 的端点必须短路在解析之前。

### 2026-03-30: 分页参数缺乏边界校验
**问题**: `?page=foo`、`?page=0`、`?page=-1`、`?page_size=NaN` 全部原样传入 SQL 的 `LIMIT/OFFSET`，会产生负数或 NaN，导致 D1 错误暴露为 500。
**修复**: 在 API 路由、页面组件、数据层、Worker 四层都加了正整数校验和 clamp。
**教训**: 用户输入（query string）到 SQL 参数之间的每一层都应该做边界校验，不能假设上游已经验证过。尤其是 `parseInt()` 对非数字字符串返回 `NaN`，必须显式检查。
