# 27 — Unified Authors

> **已由 [28 — Human Authors](./28-human-authors.md) 取代。** 单表收编 human+agent 未实现；agent 路径改动过大。

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

`docs/21` 里的静态 `firefly_agent_` key **已经不是现状**。现行代码（migration `016`）里 `ai_agents` 只是身份记录；MCP 走 OAuth token 的 `full` / `author` scope。`author` scope **没有把 token 绑到具体作者**：工具参数里的 `author_id` 由调用方自报（`src/lib/mcp/entities/author-post.ts`、`src/data/mcp-tokens.ts`）。本设计以当前代码为准，不复活静态 key，并修掉这条授权缺口。

---

## Design Decision

**一张 `authors` 表，`type = human | agent`。删掉全局 `site_author` 和 `ai_agents`。每篇文章 `author_id` 非空。**

原则：

1. **不保留向后兼容** — 删 `/admin/ai-agents`、`ai_agents`、`posts.ai_agent_id`、`site_settings.site_author`，不做双写、不做别名路由。接受一次维护窗口，见下方部署顺序。
2. **`author_email` 留下** — 仍在 `site_settings`，语义不变：站点对外联系邮箱 / RSS `managingEditor`。和 `authors.email` 不是同一个字段。
3. **站点 logo 不再当作者头像** — logo 只服务 favicon / 登录页。署名前的图来自作者自己的 `avatar_version`。
4. **`author_id` 是署名；MCP 所有权来自 token，不来自工具参数** — `mcp_tokens.author_id` 在 `scope=author` 时必填且必须指向 agent。调用方不能靠改参数冒充别的作者。
5. **Agent 必绑分类，人类不绑；分类创建后不可改** — 选 agent 当作者时，文章分类锁到该 agent 的 `category_id`。约束落在 `PostService`，所有写入口共用。
6. **恰好一个默认人类作者** — 存在 `site_settings.default_author_id`（非空 FK），不是 `authors.is_default` 旗标。
7. **公开查询按邮箱走，默认关闭** — 无认证，只回 `name` + `avatar`。作者必须显式打开 `profile_public` 才可被查到。404 **不能**当成防枚举。

### 刻意不做

| 不做 | 原因 |
|------|------|
| 公开作者主页 `/author/[slug]` | 本次只要署名和查询 API |
| 人类作者静态 API key | 人类走 Google OAuth / 完整 MCP |
| 把 `site_settings.author_email` 自动同步到默认作者 | 两个字段职责不同，避免隐式耦合 |
| 用站点 logo 给没头像的人类垫图 | 身份拆开；没头像就用 `User` 图标 |
| `human` ↔ `agent` 互转 | 分类 / 默认作者 / MCP 约束不同，删了重建 |
| expand/contract 双写 | 与「不保留向后兼容」冲突；改用维护窗口一次性切 |

---

## Schema

### Migration `019-unified-authors.sql`

用 `@batch` 包住 PRAGMA + 重建表（见 retrospective：`PRAGMA foreign_keys` 是连接级状态）。

```sql
CREATE TABLE authors (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL CHECK (type IN ('human', 'agent')),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  email           TEXT,                       -- optional, stored lowercased
  profile_public  INTEGER NOT NULL DEFAULT 0 CHECK (profile_public IN (0, 1)),
  category_id     TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  avatar_version  TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  CHECK (
    (type = 'human' AND category_id IS NULL)
    OR (type = 'agent' AND category_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_authors_email
  ON authors(email) WHERE email IS NOT NULL;
CREATE INDEX idx_authors_type ON authors(type);
CREATE INDEX idx_authors_category ON authors(category_id);

ALTER TABLE site_settings
  ADD COLUMN default_author_id TEXT REFERENCES authors(id);

ALTER TABLE mcp_tokens
  ADD COLUMN author_id TEXT REFERENCES authors(id);
```

`posts` 重建为：

```sql
author_id TEXT NOT NULL REFERENCES authors(id) ON DELETE RESTRICT
```

并 `DROP`：`posts.ai_agent_id`、`ai_agents`、`site_settings.site_author`。

回填完成后：

```sql
-- default_author_id 改为 NOT NULL（重建 site_settings 单行表）
-- CHECK 无法跨表限制 type='human'，由应用层强制
```

`mcp_tokens.author_id`：`scope='author'` 必须非空且指向 `type='agent'`（应用层 + 创建 API）；`scope='full'` 必须为 NULL。

### 字段语义

| 字段 | human | agent |
|------|-------|-------|
| `category_id` | 必须 NULL | 必须非空；同一分类可有多个 agent；**创建后不可改** |
| `email` | 可选；有则小写、全表唯一 | 可选；同样唯一 |
| `profile_public` | 默认 0；1 才允许公开查询命中 | 同左 |
| `slug` | 必填、全表唯一 | 同左 |
| `avatar_version` | 可选 | 可选 |

默认作者不在 `authors` 上：`site_settings.default_author_id` 非空，必须指向一个 human。切换默认 = `UPDATE site_settings SET default_author_id = ?`。删除该人类前必须先改指针。

没有 `is_active`、没有 `api_key_*`、没有 `is_default`（与 migration `016` 之后的现状一致，且避免「至多一个」≠「恰好一个」）。

### 数据迁移（纯 SQL，无 TS hook）

`scripts/migrations/runner.ts` 只跑 `.sql`。默认人类的 id / slug **不得**依赖 `src/models/post.ts` 的 `slugify`。

确定性规则：

1. 建 `authors`。
2. `INSERT ... SELECT` 从 `ai_agents`：`type = 'agent'`，`email = NULL`，`profile_public = 0`，**保留原 `id`**。
3. 插入一条 human：
   - `id` = `lower(hex(randomblob(16)))`（TEXT PK，与现网 ULID 混用可接受）
   - `name` = `COALESCE(NULLIF(site_author, ''), NULLIF(site_name, ''), 'Author')`
   - `slug` = `'human-' || id`（id 唯一，不再和 agent 的 `default-author` / `default-author-human` 撞 UNIQUE）
   - `email = NULL`，`profile_public = 0`
4. `UPDATE site_settings SET default_author_id = <该 human id>`。
5. `posts.author_id`：有 `ai_agent_id` 的用原 id；其余指向 `default_author_id`。
6. 确认无 NULL 后重建 `posts`（`author_id NOT NULL`）和 `site_settings`（`default_author_id NOT NULL`）。
7. `DROP TABLE ai_agents`；去掉 `site_author`。
8. 已有 `mcp_tokens`：`scope='author'` 的行在切库前若无法绑定唯一 agent，**本迁移把它们的 scope 视为失效**——`author_id` 留 NULL，应用启动后这些 token 鉴权失败，管理员在新 UI 里重发。不猜测该绑哪个 agent。

中文名、空名、与任意已有 agent slug 冲突：不在 SQL 里做拼音/unicode slugify。slug 绑在新 id 上，迁移前也不需要预扫。

### R2 头像

新路径：`{R2_KEY_PREFIX}authors/{id}/{version}/avatar-{size}.jpg`。

**单独脚本** `scripts/migrations/019-copy-author-avatars.ts`（幂等、可重跑）：

- 列出 `authors` 里 `avatar_version IS NOT NULL` 的行
- 对每个 size，若目标 key 不存在且源 `{prefix}agents/{id}/{ver}/avatar-{size}.jpg` 存在，则 Copy
- 结束时打印 `copied / skipped-exists / missing-source / failed` 计数
- 失败不回滚 SQL；missing-source 的头像 404，后台可重传

现有 `r2-client.ts` 只有 Put/Delete，脚本里直接用 S3 `CopyObject` / `HeadObject`，不塞进运行时客户端。

站点 logo 路径不变。

### 部署顺序（接受停机，无双写）

Railway 自动部署会让「先迁后发」或「先发后迁」必有一边炸掉。约定一次维护窗口。

**回滚介质不是 Backy，也不是「对现库直接 `wrangler d1 export`」。**

- Backy 是部分业务表 JSON，无恢复、不含 `mcp_tokens`（`docs/15-backy-backup.md`）。
- 本库有 FTS5 虚表 `posts_fts`（`013-fts5-search.sql`）。Cloudflare 文档写明：**含虚表的 D1 不能 export**（[D1 export limitations](https://developers.cloudflare.com/d1/best-practices/import-export-data/#known-limitations)）。不能把「完整 SQL dump」写成默认可选项。

回滚主路径：**D1 Time Travel**。

- 维护前用 `wrangler d1 info` 确认该库 `version: production`（Time Travel 只对 production D1 可用）。
- 在**另一只临时 D1** 上先演练：bookmark → 跑 019 → Time Travel 回到 bookmark → 应用旧代码仍能读。
- 生产最终 bookmark **必须在停写之后**打。公开流量会持续写 `page_views` / `posts.view_count`（`src/data/analytics-record.ts`），停写前的快照会丢掉窗口内的写入。
- 维护页必须在应用进程之外（Caddy 静态页或掐掉 Railway），避免维护页本身还打 D1。

步骤：

1. 临时库演练 Time Travel 回滚（可在窗口前做）。
2. **先停写**（停 Railway / 外置维护页）。
3. 打 Time Travel bookmark（最终 checkpoint）。
4. 对生产 D1 执行 `019-unified-authors.sql`。
5. 跑 `019-copy-author-avatars.ts`（可在窗口外补跑，头像暂时 404 可接受）。
6. 部署含新代码的 release。
7. 冒烟：首页、一篇人类文、一篇 agent 文、`/admin/authors`、新发文默认作者。
8. 失败回滚：Time Travel 回到步骤 3 的 bookmark，再部署旧 tag。schema 已 DROP，不能 forward-fix 回旧列。

分支上的 commit 仍按功能切开；**生产 apply** 必须是「停 → 迁 → 发」，不能「先合 migration 再过几天再发应用」。

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
  return {
    type: post.author_type,
    id: post.author_id,
    name: post.author_name,
    slug: post.author_slug,
    avatarUrl: getAuthorAvatarUrl(post.author_id, post.author_avatar_version, 128),
  };
}

export async function getDefaultAuthor(db: Db): Promise<Author> {
  // JOIN site_settings.default_author_id → authors
}
```

不再接收 `SiteSettings.siteAuthor`。没有作者的文章在 DB 层就不合法。

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
| JSON-LD `publisher` / WebSite author | `siteAuthor` | **默认人类** `getDefaultAuthor().name` |
| RSS `<dc:creator>` | 该篇作者名 | 不变（数据源换成 JOIN） |
| RSS `<managingEditor>` | `author_email (site_author)` | `author_email (默认人类.name)`；邮箱仍空则整段不输出 |
| `layout.tsx` `authors` / `creator` / `publisher` | `siteAuthor` | 默认人类 |
| `llms.txt` / `/api/md` 标题行 | `siteAuthor \|\| siteName` | 默认人类.name 或 `siteName` |

---

## Write-path invariants

全部写文章入口必须进 `PostService`（含 MCP full、MCP author、`POST /api/posts`、`PUT /api/posts/[slug]`、`PATCH /api/admin/posts/batch`）。数据层不信任调用方已经校过。

| 规则 | 行为 |
|------|------|
| 进入数据层的 `author_id` | 必须非空且存在，否则 400。缺省补全发生在路由层，见 API |
| 作者 `type=agent` | `category_id` 必须等于 `authors.category_id`；缺省则代填；传入其它值 400 |
| 作者 `type=human` | 分类自由 |
| 批量改分类 | 目标集里若有 agent 文章，且新分类 ≠ 该文作者的 `category_id` → 整批 400 |
| agent `category_id` | **创建后不可改**（PATCH 忽略或 400）。已有文章时也不允许改，避免一批文和作者分类分叉 |
| author-scope 改/删 | **单条条件写**：`UPDATE/DELETE ... WHERE id=? AND author_id=? AND status='private'`。`meta.changes === 0` → 409。禁止先 SELECT 再无条件写（管理员在中间点发布会漏） |

---

## Admin UI

`/admin/ai-agents` **整棵删掉**，换成 `/admin/authors`。

### 列表 `/admin/authors`

- 一张表：类型、头像、名称、slug、邮箱、公开查询开关、分类（人类显示 —）、默认标记、文章数
- 筛 `type`
- 「设为默认」只对 human 出现 → `PATCH /api/admin/authors/[id]` `{ "is_default": true }`，只更新 `site_settings.default_author_id`。不新增 `/api/admin/settings`；也不把默认作者塞进现有 `PUT /api/settings`（那条是站点身份/分页，别搅在一起）
- 创建入口两个：新建人类 / 新建代理

### 表单 `/admin/authors/new?type=human|agent` 与 `/admin/authors/[id]`

| 字段 | human | agent |
|------|-------|-------|
| 名称 / slug / 描述 / 头像 / 邮箱 | 有 | 有 |
| `profile_public` | 有，默认关 | 有，默认关 |
| 分类 | 无 | 创建时必选；编辑时只读 |
| 默认作者 | 开关（写 `default_author_id`） | 无 |
| MCP prompt | 无 | 保留现有生成器（**已经**用 `author_id`，见 `src/lib/ai-agent/prompt-generator.ts`；只需改查表） |

类型创建后不可改。删除规则：

- 有文章 → 409，先改署或删文
- `id = default_author_id` → 409，先转让默认
- 最后一个人类 → 409
- 仍被 `mcp_tokens.author_id` 引用 → 409，先删/换 token

Sidebar / command palette / i18n：`admin.page.ai-agents` → `admin.page.authors`（「作者」）。站点身份页去掉「作者名称」，**留下「作者邮箱」**，说明改为「RSS managingEditor，不是署名」。

### 文章编辑器

改这些真实入口，不是文档里虚构的 `PATCH /api/posts`：

- `src/app/admin/posts/new/page.tsx` — 加载 authors 列表
- `src/app/admin/posts/[id]/edit/page.tsx` — 同上（真实路径，不是 `[id]/page.tsx`）
- `src/components/admin/post-form.tsx` / `post-form-fields.tsx` / `post-form-helpers.ts`
- `POST /api/posts`、`PUT /api/posts/[slug]`（见 `src/app/api/posts/[slug]/route.ts`）

行为：

- 选项 = 全部 authors，按 type 分组
- 新建：预选 `site_settings.default_author_id`
- 编辑：预选当前 `author_id`
- 选中 agent：分类设为该 agent 的 `category_id` 并禁用
- 改回人类：分类解锁
- 保存：`author_id` 必填；服务端走 `PostService` 再锁一遍

---

## API

### Admin（需登录）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/admin/authors` | 列表；`?type=human\|agent` |
| POST | `/api/admin/authors` | 创建；body 含 `type` |
| GET | `/api/admin/authors/[id]` | 详情 |
| PATCH | `/api/admin/authors/[id]` | 更新；忽略 `type`；禁止改 agent `category_id`；`is_default: true` 只更新 `site_settings.default_author_id` |
| DELETE | `/api/admin/authors/[id]` | 见删除规则 |
| POST/DELETE | `/api/admin/authors/[id]/avatar` | 头像，复用现有正方形校验 |
| GET | `/api/admin/authors/[id]/prompt` | 仅 `type=agent`，否则 404 |

请求/响应字段 **snake_case**。

文章：

| Method | Path | `author_id` |
|--------|------|-------------|
| POST | `/api/posts` | **请求体可选**。路由在进 `PostService` 前：缺省 → `default_author_id`。数据层只收已经非空的值 |
| PUT | `/api/posts/[slug]` | **请求体必填**（编辑器总带当前选择）。缺省 400 |
| PATCH | `/api/admin/posts/batch` | 不改作者；改分类时走上面的批量不变量 |

`GET /api/admin/ai-agents*` 全部删除。

创建 MCP token（现有 admin MCP UI）：`scope=author` 时必须选一个 agent，写入 `mcp_tokens.author_id`。OAuth 与 refresh 见下一节，不能只改后台这一条路径。

### 公开查询（无认证）

类似 Gravatar：给邮箱，换名字和头像。**JSON，不是重定向图片。**

```
GET /api/authors/profile?email=you@example.com
GET /api/authors/profile?hash=<sha256(lowercase(trim(email)))>
```

| 条件 | 响应 |
|------|------|
| `profile_public=1` 且 email/hash 命中 | `200 { "name": "...", "avatar": "https://..." \| null }` |
| 未命中 / 未公开 / 缺参 / 非法 | `200 { "name": null, "avatar": null }`（形状统一，**不**假装这能防枚举） |
| 超限 | `429` |

约束：

- 不回 `email`、`id`、`slug`、`type`
- `email` 与 `hash` 二选一；都给以 `hash` 为准
- 库里只存小写；查询前 `trim + toLowerCase`
- 限流：`src/lib/rate-limit.ts` 按 IP，**30 / 60s**。这是**进程内**限流，多实例可放大配额；文档不把它写成反枚举方案
- 现有 `proxy.ts` 对非 admin 的 GET `/api/*` **已经公开**（没有 favicon 式 allowlist）。这里要加的是 **profile 专用限流分支**，不是再挂一条公开名单
- 默认 `profile_public=0`，迁移来的作者全部不可查，直到有人打开开关

推荐调用方用 `hash`，少把邮箱写进 access log。打开开关即表示接受「知道邮箱的人能确认该地址是否公开挂在本站」。

---

## MCP

**Token 模型**仍有 `full` / `author` 两种 scope，但 **author token 必须绑定 agent**。绑定必须覆盖完整生命周期。

**OAuth 浏览器流只签发 `full`。** `author` 只能由后台创建。不要在 authorize 页保留 author 分支。

### 谁能签发 author scope

| 路径 | 现行代码 | 之后 |
|------|----------|------|
| 后台创建 token | `src/data/mcp-tokens.ts` / admin UI | `scope=author` **必须**带 agent id，写入 `mcp_tokens.author_id` |
| OAuth authorize + `/api/mcp/token`（authorization_code） | `authCode.scope === "author"` 会原样签发（`src/app/api/mcp/token/route.ts`） | **拒绝 author**：authorize 与 code 兑换只允许 `full`。OAuth 浏览器流没有选 agent 的 UI，不在这里猜 |
| Refresh | 只继承 `scope`，不传作者（同文件 `handleRefreshToken`） | 复制 `existingToken.author_id`。若 `scope=author` 且 `author_id` 空或指向的不是活着的 agent → `invalid_grant`，**不**签发新的空绑定 token |
| `PATCH /api/mcp/tokens/[id]` 改 scope | 只改 scope（`src/app/api/mcp/tokens/[id]/route.ts`） | 原子：`full → author` 必须同时给 `author_id`（agent）；`author → full` 必须把 `author_id` 置 NULL；缺 agent 的 `full→author` → 400 |

`mcp_auth_codes` **不加** `author_id`（OAuth 不再签发 author）。

### 运行时

| 现状 | 之后 |
|------|------|
| 工具参数自报 `author_id` | `createMcpServer` / `author-post` 从 **认证上下文**取 `token.author_id`，工具 schema **删除** `author_id` |
| 任一 author token + 别人的 id | 只能动绑定的那个 agent |
| update 只剥 `status` | 条件写：`WHERE id=? AND author_id=? AND status='private'`，`changes=0` → 409。published / archived / draft 走 full scope 或后台 |
| full scope `post.ts` 的 `ai_agent_id` | `author_id`；可指定人类或 agent；仍走 `PostService` |
| prompt | 已使用 `author_id`；补一句「已发布不可改」 |

不引入新的 token 前缀。旧的 `scope=author` 且 `author_id IS NULL`：持 access token 调 MCP → 401；拿 refresh token 换新对 → `invalid_grant`。

---

## Backup

现行备份（`src/models/backup-schema.ts`）**没有** `ai_agent_id`，也**没有导入/恢复**（`docs/15-backy-backup.md`）。

`BACKUP_SCHEMA_VERSION` 升到 **2**：

- 新增 `authors: ExportedAuthor[]`（与表列一致，含 `type` / `email` / `profile_public` / `category_id`）
- `ExportedPost` **新增必填** `author_id`
- `ExportedSiteSettings` 去掉 `site_author`，保留 `author_email`，新增 `default_author_id`
- 同一次导出必须是**同一快照**：`db.batch` 一次读 `authors`、`posts`、`site_settings`（现有 `src/lib/db.ts` 已支持 batch）。禁止三个独立 `query` 并发（`src/data/backup-export.ts` 现状），否则导出中途改署会产生悬挂 `author_id` / `default_author_id`
- L1 断言：导出结果里每条 `post.author_id`、`default_author_id` 都落在同包 `authors` 里
- **不做**恢复实现。回滚生产 D1 用上一节的 Time Travel bookmark，不用这份 JSON

---

## File Structure

```
New:
├── scripts/migrations/019-unified-authors.sql
├── scripts/migrations/019-unified-authors.test.ts
├── scripts/migrations/019-copy-author-avatars.ts
├── scripts/migrations/019-copy-author-avatars.test.ts
├── src/data/entities/author.ts
├── src/data/entities/author.test.ts
├── src/lib/author.ts
├── src/lib/author.test.ts
├── src/lib/author-avatar.ts
├── src/lib/author-avatar.test.ts
├── src/app/api/admin/authors/**
├── src/app/api/authors/profile/route.ts
├── src/app/api/authors/profile/route.test.ts
├── src/app/admin/authors/**
└── src/components/admin/authors/**

Replace / delete:
├── src/data/entities/ai-agent.ts (+ test)
├── src/lib/ai-agent/**                       # prompt 迁到 src/lib/author-prompt.ts
├── src/app/api/admin/ai-agents/**
├── src/app/admin/ai-agents/**
└── src/components/admin/ai-agent*.tsx, ai-agents-*.tsx

Modify:
├── src/data/entities/post.ts, post-types.ts, post-queries.ts, post-mutations.ts
├── src/services/post-service.ts              # 所有写路径不变量
├── src/data/settings.ts                      # drop siteAuthor; add defaultAuthorId
├── src/data/mcp-tokens.ts                    # author_id
├── src/models/types.ts
├── src/models/backup-schema.ts / backup-export.ts
├── src/lib/mcp/entities/post.ts
├── src/lib/mcp/entities/author-post.ts       # 从 context 取作者
├── src/lib/mcp/server.ts / auth.ts
├── src/app/api/mcp/token/route.ts            # OAuth 拒 author；refresh 复制 author_id
├── src/app/api/mcp/tokens/[id]/route.ts      # PATCH scope 原子设/清作者
├── src/app/api/mcp/authorize/route.ts        # 只允许 full
├── src/lib/seo.ts / jsonld.ts
├── src/app/feed.xml/route.ts
├── src/app/layout.tsx
├── src/app/(blog)/**
├── src/app/api/posts/route.ts
├── src/app/api/posts/[slug]/route.ts         # PUT
├── src/app/api/admin/posts/batch/route.ts
├── src/app/admin/posts/new/page.tsx
├── src/app/admin/posts/[id]/edit/page.tsx
├── src/components/admin/post-form.tsx, post-form-fields.tsx, post-form-helpers.ts
├── src/components/admin/mcp-tokens-*.tsx     # author scope 必须选 agent
├── src/components/admin/sidebar.tsx, shell.tsx, command-palette.tsx
├── src/components/admin/site-identity-form.tsx
├── src/lib/i18n/index.ts
├── src/proxy.ts                              # profile 限流，不是公开 allowlist
├── e2e/api/admin-ai-agents.test.ts           # → admin-authors.test.ts
└── e2e/bdd/admin-ai-agents.spec.ts           # → admin-authors.spec.ts
```

---

## Testing（六维）

### L1

| 文件 | 覆盖 |
|------|------|
| `author.test.ts`（data） | CRUD；human 禁 category；agent 必 category 且不可改；email 小写 + 唯一；`default_author_id` 切换；删除拦截（有文 / 默认 / 最后人类 / 仍被 token 引用） |
| `author.test.ts`（lib） | JOIN → `PostAuthor`；无头像 → null |
| `author-avatar.test.ts` | 路径 `authors/{id}/{ver}/avatar-{size}.jpg` |
| `019-copy-author-avatars.test.ts` | 幂等；缺源计数；目标已存在 skip |
| `019-unified-authors.test.ts` | **有存量的 018→019**：夹具含 human/agent 文、`site_author`、一条 `scope=author` 的 token；跑 SQL 后检查回填、`author_id`/`default_author_id` NOT NULL、索引、`PRAGMA foreign_key_check`、未绑定 token 的 `author_id` 仍为 NULL |
| `post-service.test.ts` | agent 分类锁定；批量改分类撞 agent 文失败 |
| `post*.test.ts` | `author_id` 过滤 / 写入 |
| `settings.test.ts` | 无 `siteAuthor`；有 `defaultAuthorId` |
| `mcp-tokens.test.ts` | author scope 必须带 agent id |
| `seo` / `jsonld` / `feed` | publisher = 默认人类；byline = 该篇作者 |
| `profile/route.test.ts` | 默认不公开；打开后 email/hash 命中；未公开与未命中同形；限流 |
| `author-post.test.ts` | 上下文作者；条件 UPDATE `status='private'`；并发「先读后写」不可用无条件写 |
| `mcp/token` / `mcp/tokens/[id]` tests | OAuth 拒绝 author scope；refresh 复制 `author_id`；`author`+空绑定 refresh → invalid_grant；PATCH scope 原子设/清作者 |
| `mcp/entities/post.test.ts` | `author_id` 映射 |

### L2

| 文件 | 覆盖 |
|------|------|
| `e2e/api/admin-authors.test.ts` | 人类/agent CRUD；默认切换；删除 409；改 agent 分类 400 |
| `e2e/api/posts.test.ts` | `POST` 省略 `author_id` 落到默认人类；显式传入生效；`PUT` 缺 `author_id` 400；改署 agent 时分类被锁 |
| `e2e/api/admin-posts.test.ts` | batch 改分类撞 agent 文 400 |
| `e2e/api/authors-profile.test.ts` | 无 cookie；默认 空结果；打开后命中；超限 429 |
| `e2e/api/mcp.test.ts` | token 绑定作者；换别人的 id 无效；已发布 update/delete 失败 |
| 删除 | `e2e/api/admin-ai-agents.test.ts` |

### L3

| 场景 | 断言 |
|------|------|
| `/admin/authors` | 列表 + 类型列；无「AI 代理」h1 |
| 新建人类 / 新建代理 | 人类无分类；代理有且编辑只读 |
| 站点身份 | 无「作者名称」；有「作者邮箱」 |
| `/admin/posts/new` | 作者选择器预选默认人类 |
| 选 agent | 分类被锁 |
| 已发布人类 / agent 文 | byline 用各自头像，不用 logo |
| MCP token 创建 | author scope 必须选 agent |

### G1 / G2 / Worker

- G1：`tsc` + Biome；`rg 'ai_agents|ai_agent_id|siteAuthor|/admin/ai-agents'` 无业务引用
- G2：响应不含邮箱；不把 404 文案写成「防枚举」
- Worker：不改

---

## Atomic Commits

实现期（本文之后）按此切开。生产 apply 仍遵守「停 → 迁 → 发」。

| # | Commit | 文件 |
|---|--------|------|
| 1 | `feat(db): add authors table migration` | `019-unified-authors.sql` |
| 2 | `feat(data): add author entity` | `author.ts*` |
| 3 | `feat(data): switch posts to author_id` | `post*.ts`, `types.ts` |
| 4 | `feat(data): default author on site settings` | `settings.ts*` |
| 5 | `feat(lib): resolve post author from join` | `src/lib/author.ts*` |
| 6 | `feat(lib): author avatar urls and copy script` | `author-avatar.ts*`，`019-copy-author-avatars.ts*` |
| 7 | `feat(api): admin authors crud` | `/api/admin/authors/**`；删 ai-agents |
| 8 | `feat(api): public author profile lookup` | `/api/authors/profile/**`, `proxy.ts` |
| 9 | `feat(mcp): bind author tokens and lock published` | `mcp-tokens`, `author-post`, `server`, prompt |
| 10 | `feat(seo): author surfaces use authors table` | seo / jsonld / feed / layout / blog |
| 11 | `feat(ui): authors admin replaces ai-agents` | admin/authors, sidebar, i18n |
| 12 | `feat(ui): pick author on post form` | post-form*，`posts/new`，`posts/[id]/edit`，`POST`/`PUT` posts |
| 13 | `feat(ui): drop site author from identity` | site-identity-form |
| 14 | `feat(backup): schema v2 authors export` | backup-schema / backup-export |
| 15 | `test(e2e): authors api and bdd` | 替换 ai-agents e2e |

每步后 `bun run test`。schema：`bun run migrate:local`。

---

## Verification

```bash
bun run typecheck
bun run lint
bun run test
bun run migrate:local
bun run test:e2e:api
```

手工：

1. `/admin/authors` 能看到迁移来的 agent + 一条默认人类（名字来自原 `site_author`，slug 为 `human-<id>`）。
2. 站点身份没有作者名称，邮箱仍在。
3. 新文章默认署 `default_author_id`；改选 agent 后面分类锁死；改 agent 自己的分类被拒。
4. 人类文章 byline 不再用站点 logo。
5. `profile_public=0` 时查询得到空结果；打开后 `?email=` / `?hash=` 能拿到 name/avatar。
6. 后台新建 author-scope token 必须选 agent；OAuth 申请 author 被拒；refresh 后绑定仍在；PATCH 成 author 不带 agent 400。
7. 不能改别人的文；对已发布文的 update/delete 409（含「检查后被管理员发布」的条件写）。
8. 旧的未绑定 author token 401。
9. `rg 'ai_agents|ai_agent_id|siteAuthor|/admin/ai-agents' --glob '!docs/**' --glob '!scripts/migrations/**'` 无业务引用。

---

## 与现状的对应

| 旧 | 新 |
|----|----|
| `ai_agents` | `authors` WHERE `type='agent'` |
| `site_settings.site_author` | 一条 human + `site_settings.default_author_id` |
| `site_settings.author_email` | **不动** |
| `posts.ai_agent_id`（nullable） | `posts.author_id`（NOT NULL） |
| `/admin/ai-agents` | `/admin/authors` |
| 署名前用 logo | 署名前用作者头像 |
| MCP 工具参数里的 `author_id` | token 上的 `mcp_tokens.author_id` |
| 已发布后 agent 仍可改正文 | author scope 仅限 `private` |
