# 27 — Unified Authors

把「站点作者」和「AI 代理」收成一张 `authors` 表。文章必须挂一个作者；人类可设默认作者；AI 仍绑定分类。站点级 `author_email` 保留，仅用于 RSS。

> 日期: 2026-08-15
> 取代: [21 — AI Agent Authors](./21-ai-agent-authors.md)

---

## Problem

当前作者身份裂成两套：

| 概念 | 存哪 | 文章怎么用 |
|------|------|------------|
| 人类作者 | `site_settings.site_author`（全局一个字符串） | `posts.ai_agent_id IS NULL` 时回落到它；署名前的图是**站点 logo** |
| AI 作者 | `ai_agents`（必绑分类） | `posts.ai_agent_id` JOIN 出名字和头像 |
| 站点作者邮箱 | `site_settings.author_email` | 只进 RSS `managingEditor`，不进署名 |
| 登录邮箱 | `AUTH_ALLOWED_EMAILS` | 只控制谁能进后台 |

后果：

1. 不能有多个人类作者，也不能在发文时改署名。
2. 「AI 代理」页面和站点身份页各管一半作者，心智分裂。
3. 人类署名图盗用站点图标，logo / favicon / 作者头像缠在一起。
4. 外部系统没法按邮箱查到「这个人在本站叫什么、头像是什么」（没有类似 Gravatar 的只读接口）。

`docs/21` 里的静态 `firefly_agent_` key **已经不是现状**。现行代码（migration `016`）里 `ai_agents` 只是身份记录；MCP 走 OAuth token 的 `full` / `author` scope，`author` scope 在工具参数里带 `author_id` 再去查 `ai_agents`。本设计以**当前代码**为准，不复活静态 key。

---

## Design Decision

**一张 `authors` 表，`type = human | agent`。删掉全局 `site_author` 和 `ai_agents`。每篇文章 `author_id` 非空。**

原则：

1. **不保留向后兼容** — 删 `/admin/ai-agents`、`ai_agents`、`posts.ai_agent_id`、`site_settings.site_author`，不做双写、不做别名路由。
2. **`author_email` 留下** — 仍在 `site_settings`，语义不变：站点对外联系邮箱 / RSS `managingEditor`。和 `authors.email` 不是同一个字段。
3. **站点 logo 不再当作者头像** — logo 只服务 favicon / 登录页。署名前的图来自作者自己的 `avatar_version`。
4. **`author_id` 同时是署名和 MCP 所有权** — 和今天的 `ai_agent_id` 一样。把文章署给某个 agent 后，`author` scope 的 MCP 就能改这篇。
5. **Agent 必绑分类，人类不绑** — 选 agent 当作者时，文章分类锁到该 agent 的 `category_id`。
6. **恰好一个默认人类作者** — 新文章选择器的初始值。不能删默认作者，除非先把默认让给另一个人类。
7. **公开查询按邮箱走** — 无认证，只回 `name` + `avatar`，不回邮箱本身。

### 刻意不做

| 不做 | 原因 |
|------|------|
| 公开作者主页 `/author/[slug]` | 本次只要署名和查询 API |
| 人类作者静态 API key | 人类走 Google OAuth / 完整 MCP |
| 把 `site_settings.author_email` 自动同步到默认作者 | 两个字段职责不同，避免隐式耦合 |
| 用站点 logo 给没头像的人类垫图 | 身份拆开；没头像就用 `User` 图标 |
| `human` ↔ `agent` 互转 | 分类 / 默认作者 / MCP 约束不同，删了重建 |

---

## Schema

### Migration `019-unified-authors.sql`

用 `@batch` 包住 PRAGMA + 重建表（见 retrospective：`PRAGMA foreign_keys` 是连接级状态）。

```sql
CREATE TABLE authors (
  id              TEXT PRIMARY KEY,           -- ULID
  type            TEXT NOT NULL CHECK (type IN ('human', 'agent')),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  email           TEXT,                       -- optional, stored lowercased
  category_id     TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  avatar_version  TEXT,                       -- null = no avatar
  is_default      INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  CHECK (
    (type = 'human' AND category_id IS NULL)
    OR (type = 'agent' AND category_id IS NOT NULL)
  ),
  CHECK (type = 'human' OR is_default = 0)
);

CREATE UNIQUE INDEX idx_authors_email
  ON authors(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX idx_authors_default
  ON authors(is_default) WHERE is_default = 1;
CREATE INDEX idx_authors_type ON authors(type);
CREATE INDEX idx_authors_category ON authors(category_id);
```

`posts` 重建为：

```sql
author_id TEXT NOT NULL REFERENCES authors(id) ON DELETE RESTRICT
```

并 `DROP`：`posts.ai_agent_id`、`ai_agents`、`site_settings.site_author`。

### 字段语义

| 字段 | human | agent |
|------|-------|-------|
| `category_id` | 必须 NULL | 必须非空；同一分类可有多个 agent |
| `email` | 可选；有则小写、全表唯一 | 可选；同样唯一 |
| `is_default` | 全表恰好一行 = 1 | 必须 0 |
| `slug` | 必填、全表唯一 | 同左 |
| `avatar_version` | 可选 | 可选 |

没有 `is_active`、没有 `api_key_*`（与 migration `016` 之后的现状一致）。

### 数据迁移

1. 建 `authors`。
2. `INSERT ... SELECT` 从 `ai_agents`：`type = 'agent'`，`email = NULL`，`is_default = 0`，**保留原 `id`**（已有 `posts.ai_agent_id` 和 R2 路径都靠这个 id）。
3. 插入一条 `type = 'human'`：
   - `name` = `site_settings.site_author`；若空则用 `site_name`；再空则 `'Author'`
   - `slug` = slugify(name)，冲突则加后缀
   - `is_default = 1`
   - `email = NULL`（不从 `author_email` 拷，避免站点联系邮箱和作者查询邮箱被绑死）
4. `posts.author_id`：有 `ai_agent_id` 的用原 id；其余全部指向默认人类。
5. 确认 `author_id` 无 NULL 后，重建 `posts` 加上 `NOT NULL` + `ON DELETE RESTRICT`。
6. `DROP TABLE ai_agents`；从 `site_settings` 去掉 `site_author`。

R2：新路径 `{R2_KEY_PREFIX}authors/{id}/{version}/avatar-{size}.jpg`。迁移脚本 **best-effort** 把 `{prefix}agents/{id}/...` 拷到新前缀（失败只打日志，不回滚）。拷失败的头像 404，后台可重新上传。站点 logo 路径不变。

---

## Author Resolution

`src/lib/ai-agent/author.ts` 删掉，换成 `src/lib/author.ts`。

```ts
export interface PostAuthor {
  type: "human" | "agent";
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
}

export function getPostAuthor(post: PostWithAuthor): PostAuthor {
  // post 由 VIEW_QUERY INNER JOIN authors 带出
  return {
    type: post.author_type,
    id: post.author_id,
    name: post.author_name,
    slug: post.author_slug,
    avatarUrl: getAuthorAvatarUrl(post.author_id, post.author_avatar_version, 128),
  };
}
```

不再接收 `SiteSettings`。没有作者的文章在 DB 层就不合法。

`VIEW_QUERY`（`src/data/entities/post-types.ts`）：

```sql
SELECT p.*, c.name AS category_name, c.slug AS category_slug,
       a.type AS author_type, a.name AS author_name, a.slug AS author_slug,
       a.avatar_version AS author_avatar_version
FROM posts p
LEFT JOIN categories c ON p.category_id = c.id
JOIN authors a ON p.author_id = a.id
```

`PostWithAgent` 改名为 `PostWithAuthor`，删 `agent_*` / `ai_agent_id`。

### 各输出面

| 位置 | 现在 | 之后 |
|------|------|------|
| 文章详情 / 列表 byline | agent 或 `site_author` + logo | `getPostAuthor()`：作者名 + 作者头像 |
| `generateMetadata` / OG | `siteAuthor` 或 agent override | 该篇 `author.name` |
| JSON-LD `author` | 同上 | 该篇作者 |
| JSON-LD `publisher` / WebSite author | `siteAuthor` | **默认人类作者**的 name |
| RSS `<dc:creator>` | 该篇作者名 | 不变（数据源换成 JOIN） |
| RSS `<managingEditor>` | `author_email (site_author)` | `author_email (默认人类.name)`；邮箱仍空则整段不输出 |
| `layout.tsx` `authors` / `creator` / `publisher` | `siteAuthor` | 默认人类作者 |
| `llms.txt` / `/api/md` 标题行 | `siteAuthor \|\| siteName` | 默认人类.name 或 `siteName` |

---

## Admin UI

`/admin/ai-agents` **整棵删掉**，换成 `/admin/authors`。

### 列表 `/admin/authors`

- 一张表：类型、头像、名称、slug、邮箱、分类（人类显示 —）、默认标记、文章数
- 筛 `type`
- 「设为默认」只对 human 出现
- 创建入口两个：新建人类 / 新建代理

### 表单 `/admin/authors/new?type=human|agent` 与 `/admin/authors/[id]`

| 字段 | human | agent |
|------|-------|-------|
| 名称 / slug / 描述 / 头像 / 邮箱 | 有 | 有 |
| 分类 | 无 | 必选 |
| 默认作者 | 开关（打开则原子地清掉其他人的 `is_default`） | 无 |
| MCP prompt | 无 | 保留现有 prompt 生成器，文案里的 `ai_agent_id` 改成 `author_id` |

类型创建后不可改。删除规则：

- 有文章 → 409，先改署或删文
- 默认人类 → 409，先转让默认
- 最后一个人类 → 409（站点必须有一个默认作者）

Sidebar / command palette / i18n：`admin.page.ai-agents` → `admin.page.authors`（「作者」）。站点身份页去掉「作者名称」整块，**留下「作者邮箱」**，说明改成「RSS managingEditor，不是署名」。

### 文章编辑器

`src/components/admin/post-form*.tsx` 增加作者选择器：

- 选项 = 全部 authors（人类 + agent），按 type 分组
- 新建：预选 `is_default = 1` 的人类
- 编辑：预选当前 `author_id`
- 选中 agent：分类 select 设为该 agent 的 `category_id` 并禁用
- 改回人类：分类解锁（值保留，可改）
- 保存：`author_id` 必填；服务端再校验一遍 agent→分类锁定

---

## API

### Admin（需登录）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/admin/authors` | 列表；`?type=human\|agent` |
| POST | `/api/admin/authors` | 创建；body 含 `type` |
| GET | `/api/admin/authors/[id]` | 详情 |
| PATCH | `/api/admin/authors/[id]` | 更新；忽略 `type`；`is_default: true` 原子切换 |
| DELETE | `/api/admin/authors/[id]` | 见删除规则 |
| POST/DELETE | `/api/admin/authors/[id]/avatar` | 头像，复用现有正方形校验 |
| GET | `/api/admin/authors/[id]/prompt` | 仅 `type=agent`，否则 404 |

请求/响应字段 **snake_case**（与现有 admin/MCP 边界一致）。

`POST/PATCH /api/posts`：`ai_agent_id` 改名为 `author_id`（必填）。服务端：

- 作者必须存在
- `type=agent` → `category_id` 必须等于该作者的 `category_id`（缺省则代填）
- `type=human` → 分类自由

`GET /api/admin/ai-agents*` 全部删除，测试改挂新路径。

### 公开查询（无认证）

类似 Gravatar：给邮箱，换名字和头像。**不是重定向图片，是 JSON。**

```
GET /api/authors/profile?email=you@example.com
GET /api/authors/profile?hash=<sha256(lowercase(trim(email)))>
```

| 条件 | 响应 |
|------|------|
| 命中（该邮箱挂在某个 author 上） | `200 { "name": "...", "avatar": "https://..." \| null }` |
| 未命中 / 参数缺失 / 非法 | `404 { "error": "not found" }`（不区分原因，防枚举细节） |
| 超限 | `429` |

约束：

- 不回 `email`、`id`、`slug`、`type`
- `email` 与 `hash` 二选一；都给以 `hash` 为准
- 邮箱在查询前 `trim + toLowerCase`；库里只存小写
- 限流：现有 `src/lib/rate-limit.ts`，按 IP，**30 次 / 60s**
- `proxy.ts` 必须把 `/api/authors/profile` 列为公开（与 `/api/favicon` 同类）
- 只查 `authors.email IS NOT NULL` 的行

推荐调用方用 `hash`，避免邮箱进 access log / Referer。浏览器书签用 `email` 也可以。

---

## MCP

OAuth scope 模型不动（`full` / `author`）。改的是身份表和字段名。

| 现状 | 之后 |
|------|------|
| `createAuthorPostEntity()` 用 `getAiAgentById` | `getAuthorById`，且 `type` 必须是 `agent`（人类 id → 当作 not found） |
| 工具参数 / 过滤 `ai_agent_id` | `author_id` |
| create 强制 `status=private`、分类 = agent.category | 不变 |
| `src/lib/mcp/entities/post.ts` 的 `ai_agent_id` | `author_id`（full scope 可指定任意作者，含人类） |
| prompt 模板里的隔离说明 | `author_id` |

不引入新的 token 前缀。

---

## Backup

`BACKUP_SCHEMA_VERSION` 升到 **2**。

- 新增 `ExportedAuthor`（snake_case，与表列一致）
- `ExportedPost.ai_agent_id` → `author_id`（必填）
- `ExportedSiteSettings` 去掉 `site_author`，保留 `author_email`
- 导入侧不读 v1 的 `site_author` / `ai_agent_id`（不兼容层）

---

## File Structure

```
New:
├── scripts/migrations/019-unified-authors.sql
├── src/data/entities/author.ts
├── src/data/entities/author.test.ts
├── src/lib/author.ts                         # getPostAuthor + 默认作者
├── src/lib/author.test.ts
├── src/lib/author-avatar.ts                  # 原 avatar.ts，路径改为 authors/
├── src/lib/author-avatar.test.ts
├── src/app/api/admin/authors/**
├── src/app/api/authors/profile/route.ts      # 公开查询
├── src/app/api/authors/profile/route.test.ts
├── src/app/admin/authors/**
└── src/components/admin/authors/**

Replace / delete:
├── src/data/entities/ai-agent.ts (+ test)
├── src/lib/ai-agent/**                       # author / avatar / prompt 迁出后删除目录
├── src/app/api/admin/ai-agents/**
├── src/app/admin/ai-agents/**
└── src/components/admin/ai-agent*.tsx, ai-agents-*.tsx

Modify:
├── src/data/entities/post*.ts                # author_id, VIEW_QUERY
├── src/data/settings.ts                      # 去掉 siteAuthor
├── src/models/types.ts                       # Author, PostWithAuthor
├── src/models/backup-schema.ts               # v2
├── src/lib/mcp/entities/post.ts
├── src/lib/mcp/entities/author-post.ts
├── src/lib/seo.ts / jsonld.ts / feed.xml
├── src/app/layout.tsx
├── src/app/(blog)/**                         # getPostAuthor 调用点
├── src/components/admin/post-form*.tsx
├── src/components/admin/sidebar.tsx, shell.tsx, command-palette.tsx
├── src/components/admin/site-identity-form.tsx
├── src/lib/i18n/index.ts
├── src/proxy.ts                              # 公开 /api/authors/profile
├── e2e/api/admin-ai-agents.test.ts           # → admin-authors.test.ts
└── e2e/bdd/admin-ai-agents.spec.ts           # → admin-authors.spec.ts
```

---

## Testing（六维）

### L1

| 文件 | 覆盖 |
|------|------|
| `author.test.ts`（data） | CRUD；human 禁 category；agent 必 category；email 小写 + 唯一；默认作者原子切换；删除拦截（有文 / 默认 / 最后人类） |
| `author.test.ts`（lib） | JOIN 数据 → `PostAuthor`；无头像 → `avatarUrl: null` |
| `author-avatar.test.ts` | 路径 `authors/{id}/{ver}/avatar-{size}.jpg` |
| `post*.test.ts` | `author_id` 过滤 / 写入；agent 分类锁定 |
| `settings.test.ts` | 不再解析 / 更新 `siteAuthor` |
| `seo` / `jsonld` / `feed` | 默认人类作 publisher；byline 用该篇作者 |
| `profile/route.test.ts` | email / hash 命中；404 不泄漏；限流键 |
| `author-post.test.ts` | 人类 id 被拒；agent 分类强制 |
| `mcp/entities/post.test.ts` | `author_id` 映射 |

`siteAuthor` 从所有 fixture 删除。

### L2

| 文件 | 覆盖 |
|------|------|
| `e2e/api/admin-authors.test.ts` | 人类/agent CRUD；默认切换；删除 409；agent 无分类 400 |
| `e2e/api/posts.test.ts` | 创建默认作者；改署 agent 时分类被锁 |
| `e2e/api/authors-profile.test.ts` | 无 cookie 可查；错邮箱 404；超限 429 |
| `e2e/api/mcp.test.ts` | `author_id`；人类 id 在 author scope 失败 |
| 删除 | `e2e/api/admin-ai-agents.test.ts` |

### L3

| 场景 | 断言 |
|------|------|
| `/admin/authors` | 列表 + 类型列；不再出现「AI 代理」h1 |
| 新建人类 / 新建代理 | 人类无分类 select；代理有 |
| 站点身份 | 无「作者名称」；有「作者邮箱」 |
| 新文章表单 | 作者选择器预选默认人类 |
| 选 agent | 分类被锁 |
| 已发布人类文章 | byline 是人类名 + 人类头像（不是 logo） |
| 已发布 agent 文章 | byline 是 agent 名 + agent 头像 |

`e2e/bdd/admin-ai-agents.spec.ts` 整文件替换。

### G1 / G2 / Worker

- G1：全量 `tsc` + Biome；无残留 `ai_agents` / `siteAuthor` / `ai_agent_id` 引用（可用 `rg` 自检，不必新 gate）
- G2：公开接口不把邮箱写入响应；gitleaks 无新增
- Worker：无 schema 依赖，不改

---

## Atomic Commits

| # | Commit | 文件 |
|---|--------|------|
| 1 | `feat(db): add authors table migration` | `019-unified-authors.sql` |
| 2 | `feat(data): add author entity` | `src/data/entities/author.ts*` |
| 3 | `feat(data): switch posts to author_id` | `post*.ts`, `types.ts` |
| 4 | `feat(data): drop siteAuthor from settings` | `settings.ts*` |
| 5 | `feat(lib): resolve post author from join` | `src/lib/author.ts*`；删 `src/lib/ai-agent/author.ts` |
| 6 | `feat(lib): author avatar urls` | `author-avatar.ts*`；删旧 avatar 路径 |
| 7 | `feat(api): admin authors crud` | `/api/admin/authors/**`；删 `/api/admin/ai-agents/**` |
| 8 | `feat(api): public author profile lookup` | `/api/authors/profile/**`, `proxy.ts` |
| 9 | `feat(mcp): use authors.author_id` | `mcp/entities/*`, prompt |
| 10 | `feat(seo): author surfaces use authors table` | `seo`, `jsonld`, `feed`, `layout`, blog pages |
| 11 | `feat(ui): authors admin replaces ai-agents` | `admin/authors/**`, sidebar, i18n |
| 12 | `feat(ui): pick author on post form` | `post-form*` |
| 13 | `feat(ui): drop site author from identity` | `site-identity-form.tsx` |
| 14 | `feat(backup): schema v2 authors` | `backup-schema.ts*` |
| 15 | `test(e2e): authors api and bdd` | 替换 ai-agents e2e |
| 16 | `docs: add unified authors design` | 本文 + `docs/README.md` |

每步后：`bun run test` 绿。涉及 schema 的本地验证：`bun run migrate:local`。

---

## Verification

```bash
bun run typecheck
bun run lint
bun run test
# schema 落地后：
bun run migrate:local
bun run test:e2e:api
```

手工：

1. `/admin/authors` 能看到迁移来的 agent + 一条默认人类（名字来自原 `site_author`）。
2. 站点身份没有作者名称，邮箱仍在。
3. 新文章默认署默认人类；改选 agent 后面分类锁死。
4. 人类文章 byline 不再用站点 logo。
5. `GET /api/authors/profile?email=` 无登录返回 `{name, avatar}`。
6. MCP author scope 用 agent 的 `author_id` 仍能建私密文；传人类 id 失败。
7. `rg 'ai_agents|ai_agent_id|siteAuthor|/admin/ai-agents' --glob '!docs/**' --glob '!scripts/migrations/**'` 无业务引用。

---

## 与现状的对应

| 旧 | 新 |
|----|----|
| `ai_agents` | `authors` WHERE `type='agent'` |
| `site_settings.site_author` | 默认 `authors` 行（human, `is_default=1`） |
| `site_settings.author_email` | **不动** |
| `posts.ai_agent_id`（nullable） | `posts.author_id`（NOT NULL） |
| `/admin/ai-agents` | `/admin/authors` |
| 署名前用 logo | 署名前用作者头像 |
| MCP `ai_agent_id` | MCP `author_id` |
