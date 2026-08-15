# 28 — Human Authors

人类作者独立成表。AI agent **原样保留**。发文选择器和署名统一吃「人 XOR agent」，不把两种身份揉进一张 `authors`。

> 日期: 2026-08-15
> 取代: [27 — Unified Authors](./27-unified-authors.md)（单表 `type=human|agent` 方案，未实现）

---

## Problem

人类作者现在不是记录，是 `site_settings.site_author` 加站点 logo。Agent 已经是完整身份（`ai_agents` + `posts.ai_agent_id` + MCP）。

27 想把两者塞进一张表。审查证明几乎每条约束都要写「这个 FK 其实只能是 human / 只能是 agent」——对 agent 路径是一次无谓重写。

本方案只补人类这一半。

---

## Design Decision

**加 `humans`，加 `posts.human_id`。不改 `ai_agents`，不改 `posts.ai_agent_id`，不改 MCP。**

一篇文恰好一个署名：

| 文章 | `human_id` | `ai_agent_id` |
|------|------------|---------------|
| 人类写的 | 非空 | NULL（与今天人类文相同） |
| Agent 写的 | NULL | 非空（与今天完全相同） |

原则：

1. **Agent 零改动** — 见下方冻结清单。不为人类作者去搬 agent 的表、路由、MCP、头像路径。
2. **`author_email` 留下** — 仍在 `site_settings`，只服务 RSS `managingEditor`。和 `humans.email` 不是同一个字段。
3. **站点 logo 不再当人类头像** — logo 只做 favicon / 登录页。人类署名前的图来自 `humans.avatar_version`。
4. **默认人类** — `site_settings.default_human_id` 非空 FK，只指向 `humans`。新文章预选他。
5. **公开查询只打人类** — `GET /api/authors/profile`，默认不公开。
6. **不重建 `posts`** — 只 `ADD COLUMN human_id`，避免动 `ai_agent_id` 的 FK / 索引 / 已有行。

### Agent 冻结清单（实现期 `rg` 自检）

这些路径 **禁止**为了本功能去改语义或搬文件：

| 冻结 | 现状 |
|------|------|
| `ai_agents` 表 / `014`–`016` | 不改、不迁、不改名 |
| `posts.ai_agent_id` | 不改名、不改 NULL 语义、不重建 posts |
| `src/data/entities/ai-agent.ts` | 不改 |
| `src/lib/mcp/**`（含 `author-post.ts`、token、OAuth） | 不改 |
| `/api/admin/ai-agents/**`、`/admin/ai-agents/**` | 不改 |
| `src/lib/ai-agent/avatar.ts`、`avatar-url.ts`、`avatar.test.ts`、R2 `agents/{id}/...` | 不改 |
| `src/lib/ai-agent/prompt-generator.ts` | 不改 |
| `src/components/admin/ai-agent-*.tsx`、`ai-agents-*.tsx` | 不改 |
| `e2e/api/admin-ai-agents.test.ts`、`e2e/bdd/admin-ai-agents.spec.ts`、`e2e/api/mcp.test.ts` | 不改期望 |
| MCP `scope=author` 工具参数里的 `author_id`（实际是 agent id） | 不改 |

允许的、仅限「署名展示」的只读扩展：`VIEW_QUERY` 增加 `LEFT JOIN humans`，`getPostAuthor` 在 `ai_agent_id` 为空时改走 human，不再读 `site_author` / logo。Agent 分支保持先判 `ai_agent_id`，逻辑与今天一致。

### 刻意不做

| 不做 | 原因 |
|------|------|
| 合并 `authors` 单表 | 27 已证伪；类型谎言全落在 agent 身上 |
| 改 MCP / 已发布锁定 / token 绑 author | 那是 agent 权限问题，本篇不碰 |
| 公开 `/author/[slug]` | 只要署名和查询 API |
| 把 `author_email` 拷到默认人类 | 站点联系邮箱 ≠ 作者查询邮箱 |
| 用 logo 给没头像的人垫图 | 没头像用 `User` 图标 |
| 重建 `posts` 加 XOR CHECK | 避免动 agent 列；XOR 放应用层 |

---

## Schema

### Migration `019-human-authors.sql`

不重建 `posts` / `ai_agents`，不关 FK。**最终 DDL 就是下面这一份**，不要另选「重建 site_settings」。

SQLite / 本仓库已有 `ALTER TABLE ... DROP COLUMN`（`017-mcp-no-expiry.sql`）。**不能**把已加的 `default_human_id` 改成 NOT NULL，除非重建 `site_settings`——那会漏拷 `ai_*` / Backy 密钥列。因此：

- `default_human_id` 在库里保持可空
- 迁移**末尾断言**无 NULL；应用拒绝空默认
- `posts.human_id` 对 agent 行保持 NULL，永不 `NOT NULL`

完整语句顺序（每条可单独被 runner 跳过「已存在」）：

```sql
CREATE TABLE IF NOT EXISTS humans (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  email           TEXT,            -- 只存 trim+lower；见写入规范
  profile_public  INTEGER NOT NULL DEFAULT 0 CHECK (profile_public IN (0, 1)),
  avatar_version  TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_humans_email
  ON humans(email) WHERE email IS NOT NULL;

ALTER TABLE posts
  ADD COLUMN human_id TEXT REFERENCES humans(id);

CREATE INDEX IF NOT EXISTS idx_posts_human ON posts(human_id);

ALTER TABLE site_settings
  ADD COLUMN default_human_id TEXT REFERENCES humans(id);

-- 幂等：已有 humans 则不再插
INSERT INTO humans (id, name, slug, email, profile_public, avatar_version, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  COALESCE(NULLIF(site_author, ''), NULLIF(site_name, ''), 'Author'),
  'human-' || lower(hex(randomblob(16))),
  NULL, 0, NULL, unixepoch(), unixepoch()
FROM site_settings
WHERE id = 1
  AND NOT EXISTS (SELECT 1 FROM humans);

UPDATE site_settings
SET default_human_id = (SELECT id FROM humans ORDER BY created_at ASC LIMIT 1)
WHERE id = 1 AND default_human_id IS NULL;

UPDATE posts
SET human_id = (SELECT default_human_id FROM site_settings WHERE id = 1)
WHERE ai_agent_id IS NULL AND human_id IS NULL;

ALTER TABLE site_settings DROP COLUMN site_author;
```

迁移测试（`019-human-authors.test.ts`）必须失败即红：

- `SELECT COUNT(*) FROM site_settings WHERE default_human_id IS NULL` = 0
- `SELECT COUNT(*) FROM posts WHERE ai_agent_id IS NULL AND human_id IS NULL` = 0
- agent 文：`ai_agent_id` 原值不变，`human_id` 仍 NULL
- `PRAGMA foreign_key_check` 空

中途失败：runner **不会**记成已应用。**禁止**在半迁库上重跑碰运气；先 Time Travel 回 bookmark 再整份重跑。`DROP COLUMN site_author` 放最后，重跑时若列已删会报错——这就是要回滚再跑的原因，不要给 DROP 加「忽略错误」。

slug：`'human-' || id` 在单条 INSERT 里要用**同一个** `hex(randomblob(16))`（CTE / 子查询绑定一次），不能 name 用一个 blob、slug 再 `randomblob` 一次。上面示例写成两次是示意；实现必须：

```sql
WITH seed AS (
  SELECT lower(hex(randomblob(16))) AS hid, site_author, site_name
  FROM site_settings WHERE id = 1
)
INSERT INTO humans (id, name, slug, ...)
SELECT hid, COALESCE(...), 'human-' || hid, ... FROM seed
WHERE NOT EXISTS (SELECT 1 FROM humans);
```

应用层 XOR（`PostService`，**不是**改 MCP 文件）：

- 最终落库：`human_id` 与 `ai_agent_id` 恰有一个非空
- 选人：写 `human_id`，同一条 SQL 把 `ai_agent_id` 置 NULL
- 选 agent：写 `ai_agent_id`，同一条 SQL 把 `human_id` 置 NULL
- **full-scope MCP `update_post` 现有语义**允许 `ai_agent_id: null`（`src/lib/mcp/entities/post.ts`）。零改 MCP 文件的前提下，`PostService.update` 必须根据「库里的旧值 + 输入」算最终二元组：清空 `aiAgentId` 且未另给 `humanId` 时，**同一条 UPDATE** 写入 `default_human_id`。禁止先 UPDATE 成双 NULL。
- MCP create 仍只设 `aiAgentId`、不设 `humanId` → 合法 agent 文

删人类：有 `posts.human_id` → 409；是 `default_human_id` → 409；最后一个人类 → 409。  
删 agent：现有逻辑，不改。

---

## Author Resolution

`getPostAuthor` **仍留在** `src/lib/ai-agent/author.ts`（避免搬文件波及所有 import）。只改实现：

```ts
export interface PostAuthor {
  type: "human" | "agent";
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
}

export function getPostAuthor(post: PostWithAgent): PostAuthor {
  if (post.ai_agent_id && post.agent_name) {
    return {
      type: "agent",
      id: post.ai_agent_id,
      name: post.agent_name,
      slug: post.agent_slug!,
      avatarUrl: getAgentAvatarUrl(post.ai_agent_id, post.agent_avatar_version, 128),
    };
  }
  return {
    type: "human",
    id: post.human_id!,
    name: post.human_name!,
    slug: post.human_slug!,
    avatarUrl: getHumanAvatarUrl(post.human_id!, post.human_avatar_version, 80),
  };
}
```

Agent 分支与今天相同（先看 `ai_agent_id`）。不再接收 `settings.siteAuthor` / logo。

`VIEW_QUERY` 只 **追加** humans join，保留现有 ai_agents join：

```sql
SELECT p.*, c.name AS category_name, c.slug AS category_slug,
       a.name AS agent_name, a.slug AS agent_slug, a.avatar_version AS agent_avatar_version,
       h.name AS human_name, h.slug AS human_slug, h.avatar_version AS human_avatar_version
FROM posts p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN ai_agents a ON p.ai_agent_id = a.id
LEFT JOIN humans h ON p.human_id = h.id
```

`PostWithAgent` 加 `human_*` 字段，不改名（改名会动所有 agent 测试）。

人类头像路径（新）：`{R2_KEY_PREFIX}humans/{id}/{version}/avatar-{size}.jpg`  
尺寸沿用 agent 的 32/64/128/256，另加 80 给 byline。不复用、不搬 `agents/` 前缀。

### 各输出面

| 位置 | 现在 | 之后 |
|------|------|------|
| byline | agent 或 `site_author`+logo | agent 分支不变；否则 human 名+头像 |
| meta / OG / JSON-LD `author` | 同上 | 同上规则 |
| JSON-LD `publisher` / layout `authors` | `siteAuthor` | 默认人类 `default_human_id` |
| RSS `<dc:creator>` | 该篇作者 | 不变（agent 仍走 JOIN） |
| RSS `<managingEditor>` | `author_email (site_author)` | `author_email (默认人类.name)` |
| `llms.txt` / `/api/md` | `siteAuthor \|\| siteName` | 默认人类.name 或 `siteName` |

---

## Write-path

只约束**人类**写入口。Agent / MCP 仍只写 `aiAgentId`。

| 入口 | 行为 |
|------|------|
| `POST /api/posts` | 请求体：`human_id` / `ai_agent_id` 都可选。都缺 → 路由/Service 填 `default_human_id`。只传 `ai_agent_id` → 与今天 create 相同 |
| `PUT /api/posts/[slug]` | 带当前选择（人或 agent） |
| `PATCH /api/admin/posts/batch` | **不改署名** |
| MCP create / update | **文件零 diff**。create 只带 `aiAgentId`。update 若 `ai_agent_id: null` 由 PostService 补默认人类（见上） |

`PostService.create` 读默认人类时 **绕过** `getSiteSettings` 的 5 分钟缓存，直接 `SELECT default_human_id FROM site_settings`。  
切换默认：专用 `updateDefaultHumanId()`（仿 `updateSiteLogoVersion`），写完 `invalidateSettingsCache()`。

两者都传 → 400。现有只传 `aiAgentId` 的测试必须继续绿。增加：agent 文 MCP 清空 `ai_agent_id` → 变成默认人类；人类文改署 agent → `human_id` 空；连续两次清空仍有人类作者。

选 agent 当作者时 **不**在本篇加「锁分类到 agent.category_id」——那是今天 MCP 已做、后台尚未做的 agent 规则，单独开篇再做，避免悄悄改 agent 发文体验。

---

## Admin UI

`/admin/ai-agents` **原样保留**（列表、创建、编辑、头像、prompt）。

新增 `/admin/authors`：只管人类。

- 列表：人类的头像、名称、slug、邮箱、公开查询、默认标记、文章数
- 「设为默认」→ `PATCH /api/admin/authors/[id]` `{ "is_default": true }` 只写 `site_settings.default_human_id`
- 创建 / 编辑人类：名称、slug、描述、邮箱、`profile_public`、头像
- Sidebar 增加「作者」；**不删**「AI 代理」

站点身份：去掉「作者名称」，留下「作者邮箱」，说明改为 RSS managingEditor。

### 文章编辑器

真实路径：

- `src/app/admin/posts/new/page.tsx`
- `src/app/admin/posts/[id]/edit/page.tsx`
- `src/components/admin/post-form.tsx` / `post-form-fields.tsx` / `post-form-helpers.ts`
- `POST /api/posts`、`PUT /api/posts/[slug]`

选择器选项 = humans ∪ agents（agents 仍走现有 list API）。  
新建预选默认人类。  
选 agent：提交 `ai_agent_id`，`human_id` 空。  
选人：提交 `human_id`，`ai_agent_id` 空。

---

## API

### 人类（需登录）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/admin/authors` | 只列 humans |
| POST | `/api/admin/authors` | 创建人类 |
| GET/PATCH/DELETE | `/api/admin/authors/[id]` | 人类 CRUD；`is_default` 只改 settings |
| POST/DELETE | `/api/admin/authors/[id]/avatar` | 人类头像 |

字段 snake_case。不提供「创建 agent」——继续 `/api/admin/ai-agents`。

文章 API 增加可选 `human_id`。现有 `ai_agent_id` 字段名、含义不变。

### 公开查询（无认证，只查 humans）

```
GET /api/authors/profile?email=
GET /api/authors/profile?hash=<sha256(lowercase(trim(email)))>
```

| 条件 | 响应 |
|------|------|
| `profile_public=1` 且命中 | `200 { "name", "avatar" }` |
| 未命中 / 未公开 / 缺参 | `200 { "name": null, "avatar": null }`（不假装防枚举） |
| 超限 | `429` |

- 不回 email / id / slug
- CRUD 写入：`email` 一律 `trim().toLowerCase()`；空串存 NULL。唯一索引建在规范化后的值上（不必 `COLLATE NOCASE`）
- `email` 与 `hash` 都给 → **只认 hash**。hash 必须是 64 位小写 hex，否则当缺参
- hash = `sha256(normalizedEmail)`，查询时对 `profile_public=1` 的行现算（人类行数极少，不另存列）
- 默认 `profile_public=0`（含迁移那条）
- 限流：`src/lib/rate-limit.ts`，IP，30/60s，进程内
- `proxy.ts` 对非 admin GET `/api/*` 本就公开；这里只加 profile 限流分支
- **不查 `ai_agents`**

---

## MCP / Backup

MCP：**零 diff。**

Backup：现行导出没有 `ai_agent_id`（保持如此，本篇不补 agent 字段，避免扩大 agent 面）。

`BACKUP_SCHEMA_VERSION` → 2：

- 新增 `humans: ExportedHuman[]`
- `ExportedPost` **必有** `human_id: string | null`（converter 必须输出；human 文为 id，agent 文为 `null`）。不是「字段可缺席」
- `ExportedSiteSettings` 去掉 `site_author`，保留 `author_email`，加上 `default_human_id`
- `humans` + `posts` + `site_settings` 用一次 `db.batch` 读，避免悬挂 `human_id`
- 不做恢复

---

## 部署

加列可先于应用发布：旧代码不读 `human_id`，agent 路径不变。

1. （窗口外）`wrangler d1 info` 确认 production，临时库演练 Time Travel。本库有 FTS5，**不能**把 `wrangler d1 export` 当整库回滚。
2. 停写（停 Railway 或应用外维护页——公开流量会写 `page_views` / `view_count`）。
3. 打 Time Travel bookmark。
4. 执行 `019-human-authors.sql`。
5. 部署新代码。
6. 冒烟：agent 文 byline / MCP create 与迁库前一致；人类文 byline 不再用 logo；新文默认人类。
7. 失败：Time Travel 回 bookmark，部署旧 tag。

---

## File Structure

```
New:
├── scripts/migrations/019-human-authors.sql
├── scripts/migrations/019-human-authors.test.ts   # 有存量 018 夹具：agent 文 + 无 agent 文
├── src/data/entities/human.ts*
├── src/lib/human-avatar.ts*
├── src/app/api/admin/authors/**
├── src/app/api/authors/profile/**
├── src/app/admin/authors/**
└── src/components/admin/authors/**

Modify (human / 署名 only):
├── src/lib/ai-agent/author.ts          # 仅 human 回落；agent 分支不改条件
├── src/data/entities/post-types.ts     # VIEW_QUERY 追加 humans；Create/Update 加 humanId
├── src/data/entities/post-mutations.ts # 写 human_id
├── src/services/post-service.ts        # XOR；aiAgentId 路径保持
├── src/data/settings.ts                # drop siteAuthor; add defaultHumanId + updateDefaultHumanId
├── src/models/types.ts                 # Human；Post 加 human_id
├── src/models/backup-schema.ts / backup-export.ts
├── src/lib/seo.ts / jsonld.ts / feed / layout / blog pages
├── src/app/api/posts/route.ts, posts/[slug]/route.ts
├── src/app/admin/posts/new/page.tsx, posts/[id]/edit/page.tsx
├── src/components/admin/post-form*.tsx
├── src/components/admin/sidebar.tsx, shell.tsx, command-palette.tsx
├── src/components/admin/site-identity-form.tsx
├── src/lib/i18n/index.ts
└── src/proxy.ts                        # profile 限流

Do not touch:
└── src/data/entities/ai-agent.ts, src/lib/mcp/**, src/app/api/admin/ai-agents/**
    src/app/admin/ai-agents/**, src/lib/ai-agent/avatar.ts, prompt-generator.ts
```

---

## Testing

### L1

| 文件 | 覆盖 |
|------|------|
| `human.test.ts` | CRUD；email 小写唯一；默认切换；删除拦截 |
| `human-avatar.test.ts` | `humans/{id}/...` 路径 |
| `019-human-authors.test.ts` | 夹具含 **已有 agent 文**：迁完 `ai_agent_id` 不变、`human_id` 仍 NULL；无 agent 文补上 human；`default_human_id` 非空 |
| `author.test.ts` | agent 分支仍只看 `ai_agent_id`；无 agent 走 human，不用 logo |
| `post-service.test.ts` | 只传 `aiAgentId` 与今天一致；都不传 → 默认人类；两者都传 400；`aiAgentId: null` 更新 agent 文 → 同一语句写成默认人类 |
| `settings.test.ts` | 无 `siteAuthor`；有 `defaultHumanId` |
| `profile/route.test.ts` | 默认不公开；不查 agent |
| `seo` / `jsonld` / `feed` | publisher = 默认人类；agent 文 creator 仍是 agent |
| **回归** | 现有 `ai-agent.test.ts`、`author-post.test.ts`、`mcp/**` **必须仍绿且不改断言语义** |

### L2

| 文件 | 覆盖 |
|------|------|
| `e2e/api/admin-authors.test.ts` | 人类 CRUD |
| `e2e/api/posts.test.ts` | POST 省略署名 → 默认人类；带 `ai_agent_id` 行为与旧测试相同 |
| `e2e/api/authors-profile.test.ts` | 无 cookie；默认空结果 |
| **回归** | `e2e/api/admin-ai-agents.test.ts`、`e2e/api/mcp.test.ts` **不改期望** |

### L3

| 场景 | 断言 |
|------|------|
| `/admin/ai-agents` | 与现在相同（h1、创建代理……现有 spec 继续过） |
| `/admin/authors` | 人类列表；设默认 |
| `/admin/posts/new` | 选择器预选默认人类；能选到已有 agent |
| 已发布 agent 文 | byline 仍是 agent 名+agent 头像 |
| 已发布人类文 | byline 是人类，不是 logo |
| 站点身份 | 无作者名称；有作者邮箱 |

### G1 / G2

- 公开接口不回邮箱
- 实现验收：`git diff --name-only <base>...HEAD` 不得出现冻结清单里的路径（denylist），不要只靠 `rg`

---

## Atomic Commits

| # | Commit | 文件 |
|---|--------|------|
| 1 | `feat(db): add humans table` | `019-human-authors.sql` + 存量迁移测试 |
| 2 | `feat(data): add human entity` | `human.ts*` |
| 3 | `feat(data): posts.human_id and default human` | post*、settings |
| 4 | `feat(lib): resolve human byline` | `author.ts`、`human-avatar.ts*` |
| 5 | `feat(api): admin humans and profile` | `/api/admin/authors/**`、profile、proxy |
| 6 | `feat(seo): human publisher fallback` | seo / jsonld / feed / layout / blog |
| 7 | `feat(ui): humans admin and post picker` | admin/authors、post-form、posts/new、posts/[id]/edit |
| 8 | `feat(ui): drop site author name` | site-identity-form |
| 9 | `feat(backup): export humans` | backup-schema / backup-export |
| 10 | `test(e2e): human authors` | 新 e2e；不改 ai-agents / mcp 期望 |

每步 `bun run test`。agent 相关测试不得为了本功能去改绿。

---

## Verification

```bash
bun run typecheck && bun run lint && bun run test
bun run migrate:local
bun run test:e2e:api
```

手工：

1. 迁库后已有 agent 文的 `ai_agent_id`、头像 URL、MCP create_post 与迁前一致。
2. `/admin/ai-agents` 交互不变。
3. `/admin/authors` 只有迁移来的那条人类（slug `human-<id>`）。
4. 新文章默认署该人类；改选 agent 后保存，行上 `human_id` 空、`ai_agent_id` 有值。
5. 人类 byline 不用 logo；agent byline 仍用 agent 头像。
6. `profile_public=0` 时查询空结果。

---

## 与 27 / 现状

| | 现在 | 27（废弃） | 28（本篇） |
|--|------|------------|------------|
| 人类 | `site_author` + logo | `authors` type=human | `humans` |
| Agent | `ai_agents` | 迁进 `authors` type=agent | **不动** |
| 文章指针 | nullable `ai_agent_id` | 单一 `author_id` NOT NULL | `human_id` XOR `ai_agent_id` |
| MCP | 不改 | 重绑 token / 锁已发布 | **不改** |
| 默认作者 | 无（隐式 site_author） | `default_author_id` → authors | `default_human_id` → humans |
| 公开查询 | 无 | 查合并表 | 只查 humans |
