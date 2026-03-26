# 16 — Backy Backup Integration

Firefly 集成 [Backy](https://backy.dev.hexly.ai) 远程备份服务，实现博客核心数据的推送备份与历史查看。

**状态**: ✅ 已实现

---

## 一、概述

### 1.1 目标

将 Firefly 的核心数据（文章、分类、标签、站点设置）备份至 Backy 远程服务，支持：

- **手动推送备份** — 管理员在后台一键推送
- **被动拉取备份** — Backy cron 通过 Pull Webhook 触发自动推送
- **备份历史查看** — 推送后自动刷新远程备份记录列表

### 1.2 不做的事

- **恢复** — 暂不实现从备份恢复数据
- **增量备份** — 每次全量导出，不做差异比对
- **统计数据备份** — `page_views`、`daily_stats`、`site_daily_stats` 不在备份范围
- **敏感信息备份** — `ai_api_key` 以及 `.env` 中的 secrets 不备份

### 1.3 参考实现

Zhe（短链接服务）的 Backy 集成：完整 MVVM 分层、Push + Pull 双模式、六维测试覆盖。本设计在架构模式上 1:1 对齐 Zhe，在数据模型上适配 Firefly 的 D1 schema。

---

## 二、备份数据范围

### 2.1 备份内容

| 数据 | 来源表 | 字段 | 说明 |
|------|--------|------|------|
| 文章 | `posts` | 全部字段 | 含 markdown source + HTML cache + reference URL |
| 分类 | `categories` | 全部字段 | 含 `post_count`（可重建但备份省事） |
| 标签 | `tags` | 全部字段 | 含 `post_count` |
| 文章-标签关联 | `post_tags` | `post_id`, `tag_id` | 多对多关系 |
| 评论 | `comments` | 全部字段 | 只读历史数据，但仍需备份保存 |
| 附件元数据 | `attachments` | 全部字段 | R2 对象的元数据记录（不含文件本体） |
| 重定向 | `redirects` | 全部字段 | WordPress 301 重定向规则 |
| 站点设置 | `site_settings` | **部分字段** | 见 2.2 排除列表 |

### 2.2 排除内容

| 数据 | 原因 |
|------|------|
| `page_views` | 统计信息，数据量大且可重建 |
| `daily_stats` | 聚合统计，可从 `page_views` 重建 |
| `site_daily_stats` | 全站聚合统计 |
| `users` | 认证数据，通过 OAuth 恢复 |
| `mcp_clients` / `mcp_auth_codes` / `mcp_tokens` | OAuth 会话数据，恢复后需重新授权 |
| `site_settings.ai_api_key` | 敏感 AI 密钥 |
| `site_settings.backy_*` | Backy 自身的配置（新增字段），避免循环 |
| R2 文件本体 | 对象存储文件，不通过此通道备份 |
| `.env` 中的 secrets | `WORKER_SECRET`、`AUTH_SECRET`、R2 凭证等 |

### 2.3 站点设置备份字段明细

从 `site_settings` singleton 行中选择性备份：

```
✅ 备份: locale, posts_per_page, comments_enabled, font_style,
         site_logo_version, site_name, site_tagline, site_description,
         site_author, author_email, twitter_handle, social_links
         ai_provider, ai_model, ai_base_url, ai_sdk_type

❌ 排除: ai_api_key (敏感)
         backy_webhook_url, backy_api_key, backy_pull_key (自身配置)
```

---

## 三、JSON Schema

### 3.1 Backup Envelope

```typescript
interface FireflyBackupEnvelope {
  schemaVersion: 1;
  exportedAt: string;                    // ISO 8601
  appVersion: string;                    // e.g. "1.4.0"
  posts: ExportedPost[];
  categories: ExportedCategory[];
  tags: ExportedTag[];
  postTags: ExportedPostTag[];
  comments: ExportedComment[];
  attachments: ExportedAttachment[];
  redirects: ExportedRedirect[];
  siteSettings: ExportedSiteSettings;
}
```

### 3.2 Exported Types

所有时间戳字段统一从 Unix epoch (`number`) 转换为 ISO 8601 字符串，保证 JSON 可读性和跨系统兼容。

```typescript
interface ExportedPost {
  id: string;                            // ULID
  title: string;
  slug: string;
  content: string;                       // markdown source
  content_html: string | null;           // rendered HTML cache
  excerpt: string | null;
  status: "draft" | "published" | "private" | "archived";
  category_id: string | null;
  featured_image: string | null;
  comment_enabled: number;               // 0 | 1
  comment_count: number;
  view_count: number;
  reading_time: number | null;
  wp_id: number | null;
  wp_permalink: string | null;
  reference_url: string | null;
  reference_title: string | null;
  reference_description: string | null;
  reference_image: string | null;
  published_at: string | null;           // ISO 8601
  created_at: string;                    // ISO 8601
  updated_at: string;                    // ISO 8601
}

interface ExportedCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  post_count: number;
  created_at: string;
  updated_at: string;
}

interface ExportedTag {
  id: string;
  name: string;
  slug: string;
  post_count: number;
  created_at: string;
  updated_at: string;
}

interface ExportedPostTag {
  post_id: string;
  tag_id: string;
}

interface ExportedComment {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_name: string;
  author_email: string | null;
  author_url: string | null;
  content: string;
  wp_id: number | null;
  created_at: string;
}

interface ExportedAttachment {
  id: string;
  filename: string;
  r2_key: string;
  mime_type: string;
  size: number | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  wp_id: number | null;
  created_at: string;
}

interface ExportedRedirect {
  id: string;
  source_path: string;
  target_path: string;
  status_code: number;
  hit_count: number;
  created_at: string;
}

interface ExportedSiteSettings {
  locale: string;
  posts_per_page: number;
  comments_enabled: number;
  font_style: string;
  site_logo_version: string | null;
  site_name: string;
  site_tagline: string;
  site_description: string;
  site_author: string;
  author_email: string;
  twitter_handle: string;
  social_links: string;                  // JSON string
  ai_provider: string;
  ai_model: string;
  ai_base_url: string;
  ai_sdk_type: string;
  updated_at: string;                    // ISO 8601 — 配置最后修改时间
}
```

### 3.3 字段与数据库对齐规则

**Exported 实体类型**（`ExportedPost`、`ExportedCategory` 等）的字段名与 D1 表的列名一致（snake_case），仅时间戳从 `number`（Unix epoch）转为 `string`（ISO 8601）。此规则适用于各实体内部字段，不包含：

- **Envelope 顶层 key** — 使用 camelCase（`postTags`、`siteSettings`），因为这是 JSON envelope 层而非 DB 映射层
- **被裁剪的 `site_settings` 列** — `ai_api_key`、`backy_*`、`id` 被刻意排除，不出现在 `ExportedSiteSettings` 中
- `site_settings.updated_at` 保留备份 — 它记录的是"配置最后修改时间"，与 envelope 的 `exportedAt`（备份创建时间）语义不同，恢复时需要还原

这确保了：

- 各实体字段一目了然，无需额外映射文档
- 未来恢复实现时，可直接用字段名构造 INSERT 语句
- 敏感字段从 SQL 查询层面就被排除（SELECT 列白名单），而非查询后删除

---

## 四、压缩策略

由于 Firefly 的备份数据包含完整的 markdown 内容和 HTML 缓存，JSON 文件体积可能较大。

### 4.1 流程

```
收集数据 → JSON.stringify → gzip 压缩 → multipart/form-data POST
```

### 4.2 实现

```typescript
import { gzipSync } from "node:zlib";

const json = JSON.stringify(envelope);
const compressed = gzipSync(Buffer.from(json));
const blob = new Blob([compressed], { type: "application/gzip" });

const form = new FormData();
form.append("file", blob, fileName);  // firefly-backup-2026-03-26T14-30-05-a7x2.json.gz
form.append("environment", environment);
form.append("tag", tag);
```

### 4.3 文件命名

```
firefly-backup-{YYYY-MM-DD}T{HH-mm-ss}-{rand4}.json.gz
```

示例: `firefly-backup-2026-03-26T14-30-05-a7x2.json.gz`

时间精确到秒 + 4 位随机后缀（`nanoid(4)`），确保即使同秒双击/重试也不会碰撞。格式化用 ISO 8601 替换 `:` 为 `-`。

Backy 通过文件扩展名 `.gz` 检测类型，上传后 Backy 可自动提取预览 JSON。

---

## 五、架构设计

### 5.1 MVVM 分层

```
┌─────────────────────────────────────────────────────────────────┐
│  UI Layer                                                       │
│  components/admin/backup-page.tsx    — 备份管理页面              │
│                                                                 │
│  Page Layer                                                     │
│  app/admin/backup/page.tsx           — SSR 数据预取              │
│                                                                 │
│  API Layer                                                      │
│  app/api/backup/route.ts             — Push config CRUD          │
│  app/api/backup/test/route.ts        — 测试连接                  │
│  app/api/backup/push/route.ts        — 推送备份                  │
│  app/api/backup/history/route.ts     — 查询备份历史              │
│  app/api/backup/pull/route.ts        — Pull Webhook (M2M)        │
│  app/api/backup/pull-key/route.ts    — Pull Key 管理             │
│                                                                 │
│  Model Layer                                                    │
│  models/backup.ts                    — 类型 + 纯函数             │
│  models/backup.server.ts             — Node crypto (server-only) │
│  models/backup-schema.ts             — Envelope + Exported types │
│                                                                 │
│  Data Layer                                                     │
│  data/backup.ts                      — D1 查询 (backy 配置)     │
│  data/backup-export.ts               — 数据收集 + 序列化 + 压缩 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 数据流

#### Push 流程（手动 + Pull 触发共用）

```
1. 并行查询: posts + categories + tags + postTags + comments
                    + attachments + redirects + siteSettings
2. 组装 FireflyBackupEnvelope
3. JSON.stringify → gzip 压缩
4. multipart/form-data POST → Backy webhook
5. 成功后 inline GET 获取备份历史（非阻塞，5s 超时）
```

**部分成功语义**: Push 上传和 History 拉取是两个独立操作。`BackyPushDetail` 的结果字段设计如下：

| 场景 | `ok` | `history` | UI 展示 |
|------|------|-----------|---------|
| Push 成功 + History 成功 | `true` | `BackyHistoryResponse` | 绿色成功 + 历史列表刷新 |
| Push 成功 + History 失败/超时 | `true` | `undefined` | 绿色成功 + 历史列表保持旧数据，不显示错误 |
| Push 失败 | `false` | N/A | 红色失败 + HTTP status + body |

History 获取失败**不影响 Push 的成功判定**——用户看到的是"推送成功"，历史列表可通过"刷新历史"按钮手动重试。inline history 是优化（省一次 round-trip），不是必需路径。

#### Pull 流程（Backy cron 触发）

```
Backy cron → POST /api/backup/pull (X-Webhook-Key header)
  → 验证 key → 查 backy_push 配置 → 执行 Push 流程 → 返回结果
```

### 5.3 与 Zhe 实现的差异

| 方面 | Zhe | Firefly |
|------|-----|---------|
| 数据访问 | `ScopedDB` (多用户) | 直接 `getDb()` (单用户) |
| Auth guard | `getScopedDB()` session | proxy.ts 全方法保护（参照 `/api/analytics` 先例） |
| Pull key 存储 | `user_settings` 表 | `site_settings` 表 (新增列) |
| 压缩 | 无（JSON 直传） | **gzip 压缩**（数据量大） |
| 路由前缀 | `/api/backy/*` | `/api/backup/*` |
| Envelope 内容 | links, folders, tags, linkTags | posts, categories, tags, postTags, comments, attachments, redirects, siteSettings |

---

## 六、数据库变更

### 6.1 Migration 010

在 `site_settings` singleton 表新增 Backy 相关列：

```sql
-- 010-backup.sql
ALTER TABLE site_settings ADD COLUMN backy_webhook_url TEXT DEFAULT '';
ALTER TABLE site_settings ADD COLUMN backy_api_key TEXT DEFAULT '';
ALTER TABLE site_settings ADD COLUMN backy_pull_key TEXT DEFAULT '';
```

### 6.2 字段说明

| 列 | 类型 | 说明 |
|----|------|------|
| `backy_webhook_url` | TEXT | Backy webhook URL (e.g. `https://backy.dev.hexly.ai/api/webhook/{projectId}`) |
| `backy_api_key` | TEXT | Bearer token (48-char nanoid) |
| `backy_pull_key` | TEXT | Pull webhook UUID key (Backy 回调认证) |

---

## 七、API 路由设计

### 7.1 鉴权策略（proxy.ts 变更）

**现状问题**: 当前 `proxy.ts` 只保护 POST/PUT/DELETE/PATCH 方法的 API 路由，GET 默认公开。但 backup 管理端点的 GET 路由会返回脱敏 API key、备份历史、pull key 等敏感数据，不能公开暴露。

**方案**: 参照 `/api/analytics` 的先例，在 `isProtectedApiRoute()` 中将 `/api/backup` 前缀整体设为受保护路由（所有 HTTP 方法都需要 OAuth），再用精确匹配豁免 `/api/backup/pull`（M2M 调用，自带 key 认证）：

```typescript
// In isProtectedApiRoute():
// Backup endpoints require admin auth for all methods (including GET),
// except the exact /api/backup/pull path which uses its own X-Webhook-Key auth.
// IMPORTANT: Must NOT use startsWith("/api/backup/pull") — that would also
// exempt /api/backup/pull-key, leaking the pull key to unauthenticated requests.
if (pathname.startsWith("/api/backup")) {
  if (pathname === "/api/backup/pull") return false;  // M2M, own auth
  return true;
}
```

> **⚠️ 为什么不用 `startsWith("/api/backup/pull")`**: `/api/backup/pull-key` 也匹配该前缀，会被错误豁免，导致 pull key 泄露给未认证请求。必须用精确匹配 `pathname === "/api/backup/pull"`。

### 7.2 管理端点（需 OAuth 登录，proxy.ts 全方法拦截）

| 方法 | 路由 | 说明 |
|------|------|------|
| `GET` | `/api/backup` | 获取 push 配置（URL + 脱敏 key） |
| `PUT` | `/api/backup` | 保存 push 配置（URL + API key） |
| `DELETE` | `/api/backup` | 清除 push 配置 |
| `POST` | `/api/backup/test` | 测试 Backy 连接 (HEAD → Backy) |
| `POST` | `/api/backup/push` | 执行推送备份 |
| `GET` | `/api/backup/history` | 获取 Backy 备份历史 |
| `GET` | `/api/backup/pull-key` | 获取 pull webhook key |
| `POST` | `/api/backup/pull-key` | 生成/重新生成 pull key |
| `DELETE` | `/api/backup/pull-key` | 撤销 pull key |

### 7.3 Pull Webhook 端点（公开，key 认证）

| 方法 | 路由 | 说明 |
|------|------|------|
| `HEAD` | `/api/backup/pull` | 验证 pull key 有效性 |
| `POST` | `/api/backup/pull` | 触发推送（Backy cron 调用） |

`/api/backup/pull` 被 proxy.ts 显式豁免 OAuth，自身通过 `X-Webhook-Key` header 做 key 认证。

---

## 八、Model 层设计

### 8.1 `models/backup.ts` — 类型 + 纯函数

```typescript
// Types
export interface BackyConfig { webhookUrl: string; apiKey: string; }
export interface BackyHistoryResponse { ... }
export interface BackyBackupEntry { ... }
export interface BackyPushDetail { ... }

// Validation
export function isValidWebhookUrl(url: string): boolean;
export function validateBackyConfig(config: Partial<BackyConfig>): ValidationResult;

// Formatting
export function maskApiKey(key: string): string;
export function getBackyEnvironment(): "prod" | "dev";
export function buildBackyTag(version: string, counts: BackupCounts, rand: string): string;
export function formatFileSize(bytes: number): string;
export function formatTimeAgo(dateStr: string): string;
```

### 8.2 `models/backup.server.ts` — Server-only

```typescript
"server-only";
import { randomUUID } from "node:crypto";

export function generatePullWebhookKey(): string {
  return randomUUID();
}
```

### 8.3 `models/backup-schema.ts` — Envelope + Exported types

```typescript
export const BACKUP_SCHEMA_VERSION = 1;
export interface FireflyBackupEnvelope { ... }
export interface ExportedPost { ... }
// ... all Exported types
```

---

## 九、Data 层设计

### 9.1 `data/backup.ts` — Backy 配置 CRUD

```typescript
// Read
export async function getBackyConfig(db: Db): Promise<BackyConfig | null>;
export async function getBackyPullKey(db: Db): Promise<string | null>;

// Write
export async function saveBackyConfig(db: Db, config: BackyConfig): Promise<void>;
export async function clearBackyConfig(db: Db): Promise<void>;
export async function saveBackyPullKey(db: Db, key: string): Promise<void>;
export async function clearBackyPullKey(db: Db): Promise<void>;

// Pull key verification (for pull route, no auth guard)
export async function verifyBackyPullKey(db: Db, key: string): Promise<boolean>;
```

### 9.2 `data/backup-export.ts` — 数据收集 + 序列化 + 压缩

```typescript
import { gzipSync } from "node:zlib";

/** Collect all backup data from DB */
export async function collectBackupData(db: Db): Promise<FireflyBackupEnvelope>;

/** Serialize envelope to compressed .gz buffer */
export async function serializeBackup(
  db: Db,
): Promise<{ buffer: Buffer; envelope: FireflyBackupEnvelope }>;
```

`collectBackupData` 内部并行查询所有表，**每张表显式 ORDER BY 主键**以保证输出稳定（利于 diff、回归测试、定位异常）：

```typescript
const [posts, categories, tags, postTags, comments, attachments, redirects, settings] =
  await Promise.all([
    db.query<Post>("SELECT * FROM posts ORDER BY id"),
    db.query<Category>("SELECT * FROM categories ORDER BY id"),
    db.query<Tag>("SELECT * FROM tags ORDER BY id"),
    db.query<PostTag>("SELECT * FROM post_tags ORDER BY post_id, tag_id"),
    db.query<Comment>("SELECT * FROM comments ORDER BY id"),
    db.query<Attachment>("SELECT * FROM attachments ORDER BY id"),
    db.query<Redirect>("SELECT * FROM redirects ORDER BY id"),
    db.firstOrNull<SiteSettingsRow>(
      "SELECT locale, posts_per_page, comments_enabled, font_style, " +
      "site_logo_version, site_name, site_tagline, site_description, " +
      "site_author, author_email, twitter_handle, social_links, " +
      "ai_provider, ai_model, ai_base_url, ai_sdk_type, updated_at " +
      "FROM site_settings WHERE id = 1",
    ),
  ]);
```

注意 `site_settings` 查询显式列出所有需要的列（排除 `ai_api_key` 和 `backy_*`），而非 `SELECT *` + 后处理删除。这样即使未来新增敏感列也不会意外泄露。

时间戳转换统一用 helper：

```typescript
function epochToIso(epoch: number): string {
  return new Date(epoch * 1000).toISOString();
}

function nullableEpochToIso(epoch: number | null): string | null {
  return epoch ? new Date(epoch * 1000).toISOString() : null;
}
```

---

## 十、UI 设计

### 10.1 导航位置

Sidebar `NAV_GROUPS` 的"系统"分组新增一项：

```typescript
{ titleKey: "admin.nav.backup", href: "/admin/backup", icon: CloudUpload }
```

顺序排在最后：Settings → Site Identity → AI Settings → MCP Tokens → **Backup**

### 10.2 页面结构

路由: `/admin/backup`

两张卡片布局（与 Zhe 一致）：

```
┌─────────────────────────────────────────────────────────────┐
│ 卡片 1: 远程备份 (Push)                          紫色 accent │
│                                                             │
│ [未配置态]                                                   │
│   Webhook URL 输入框                                         │
│   API Key 输入框 (type=password)                             │
│   [保存] 按钮                                                │
│                                                             │
│ [已配置态]                                                   │
│   URL (code block) + 脱敏 Key + ✏️ 编辑按钮                 │
│   环境 Badge (prod 绿 / dev 黄)                              │
│   [测试连接] [推送备份] 按钮                                  │
│   测试结果 / 推送结果                                         │
│   ─── 分隔线 ───                                             │
│   远程备份记录列表 (grid: environment, tag, size, time)       │
│   [刷新历史] 按钮                                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 卡片 2: 拉取 Webhook (Pull)                      黄色 accent │
│                                                             │
│ [无凭证态]                                                   │
│   说明文字 + [生成凭证] 按钮                                  │
│                                                             │
│ [有凭证态]                                                   │
│   Webhook URL (可复制)                                       │
│   Key + X-Webhook-Key header 名 (可复制)                     │
│   [重新生成] [撤销] 按钮                                      │
│   curl 调用示例                                              │
└─────────────────────────────────────────────────────────────┘
```

### 10.3 推送结果展示

成功时显示：
- Tag: `v1.4.0-2026-03-26T14-30-05-a7x2-42post-5cat-12tag`
- 文件名: `firefly-backup-2026-03-26T14-30-05-a7x2.json.gz`
- 压缩前/后大小
- 各实体数量统计: `42 文章 · 5 分类 · 12 标签 · 120 标签关联 · 89 评论 · 56 附件 · 30 重定向`
- 耗时

### 10.4 Backup Tag 格式

```
v{version}-{datetime}-{rand4}-{posts}post-{cats}cat-{tags}tag
```

`{datetime}` 格式为 `YYYY-MM-DDTHH-mm-ss`（ISO 8601 秒级精度，冒号替换为连字符），`{rand4}` 为 `nanoid(4)` 随机后缀（与文件名共用同一个值），确保同秒双击/重试时 tag 也严格唯一。

示例: `v1.4.0-2026-03-26T14-30-05-a7x2-42post-5cat-12tag`

---

## 十一、i18n

在 `src/i18n/locales/zh.json` 和 `en.json` 中新增：

```json
{
  "admin.nav.backup": "备份 / Backup",
  "admin.backup.title": "备份管理 / Backup",
  "admin.backup.push.title": "远程备份 / Remote Backup",
  "admin.backup.push.description": "...",
  "admin.backup.pull.title": "拉取 Webhook / Pull Webhook",
  "..."
}
```

---

## 十二、Backy 侧配置

在 Backy 管理后台创建 Firefly 项目：

1. 创建 Project: name = `Firefly`
2. 记录 webhook URL: `https://backy.dev.hexly.ai/api/webhook/{projectId}`
3. 记录 webhook token（48 字符）
4. 配置自动备份（可选）：interval = 24h, webhook = `https://firefly.dev.hexly.ai/api/backup/pull`

---

## 十三、测试策略（六维质量体系）

### 13.1 L1 — Unit Tests (pre-commit)

> **测试文件位置**: 沿用项目现有 colocated 风格，unit test 放在被测文件旁边（如 `src/models/backup.test.ts`），不单独建 `tests/unit/` 目录。

| 文件 | 覆盖内容 | 预估 cases |
|------|----------|-----------|
| `src/models/backup.test.ts` | `isValidWebhookUrl`, `validateBackyConfig`, `maskApiKey`, `getBackyEnvironment`, `buildBackyTag`, `formatFileSize`, `formatTimeAgo` | ~25 |
| `src/models/backup-schema.test.ts` | `epochToIso`, `nullableEpochToIso`, `collectBackupData` 返回结构验证, 敏感字段排除验证, schema version | ~15 |
| `src/data/backup.test.ts` | `getBackyConfig`, `saveBackyConfig`, `clearBackyConfig`, `getBackyPullKey`, `saveBackyPullKey`, `clearBackyPullKey`, `verifyBackyPullKey` — mock DB | ~20 |
| `src/data/backup-export.test.ts` | `collectBackupData` 完整性 (所有表都被查询), `serializeBackup` 压缩验证 (输出为有效 gzip, 解压后为有效 JSON, schema version 正确) | ~12 |
| `src/proxy.test.ts` | **鉴权规则测试（最高优先级）**: 直接测 `isProtectedApiRoute` 函数，验证 backup 路由的保护矩阵 | ~10 |

> **⚠️ 为什么鉴权测试在 L1 而非 L2**: 现有 E2E 基建中 `.env.test` 固定开启 `E2E_SKIP_AUTH=true`，`proxy.ts` 会直接放行所有请求（见 `e2e/api/auth.test.ts` 注释）。因此 401 行为无法在 L2 API E2E 中验证。鉴权规则的正确性通过 L1 直接测 `isProtectedApiRoute(pathname, method)` 纯函数来保证：

```typescript
// src/proxy.test.ts — backup route protection matrix
describe("isProtectedApiRoute — backup routes", () => {
  // 管理端点：所有方法都受保护
  it("protects GET /api/backup", () => {
    expect(isProtectedApiRoute("/api/backup", "GET")).toBe(true);
  });
  it("protects GET /api/backup/history", () => {
    expect(isProtectedApiRoute("/api/backup/history", "GET")).toBe(true);
  });
  it("protects GET /api/backup/pull-key", () => {
    expect(isProtectedApiRoute("/api/backup/pull-key", "GET")).toBe(true);
  });
  it("protects PUT /api/backup", () => {
    expect(isProtectedApiRoute("/api/backup", "PUT")).toBe(true);
  });
  it("protects DELETE /api/backup/pull-key", () => {
    expect(isProtectedApiRoute("/api/backup/pull-key", "DELETE")).toBe(true);
  });

  // Pull webhook：精确豁免
  it("exempts HEAD /api/backup/pull (M2M)", () => {
    expect(isProtectedApiRoute("/api/backup/pull", "HEAD")).toBe(false);
  });
  it("exempts POST /api/backup/pull (M2M)", () => {
    expect(isProtectedApiRoute("/api/backup/pull", "POST")).toBe(false);
  });

  // 关键：pull-key 不被 pull 豁免误伤
  it("does NOT exempt /api/backup/pull-key (not pull)", () => {
    expect(isProtectedApiRoute("/api/backup/pull-key", "GET")).toBe(true);
  });
});
```

> **前提**: `isProtectedApiRoute` 当前是 `proxy.ts` 的私有函数，实现时需要导出或通过 `_testHelpers` 暴露。

**核心断言**:
- `ai_api_key` 不出现在序列化结果中
- `backy_*` 字段不出现在序列化结果中
- `page_views`、`daily_stats`、`site_daily_stats` 数据不出现
- 所有时间戳字段为 ISO 8601 格式
- gzip 解压后的 JSON 包含所有预期的顶层 key

### 13.2 L2 — API E2E Tests (pre-push)

| 文件 | 覆盖内容 | 预估 cases |
|------|----------|-----------|
| `e2e/api/backup.test.ts` | 管理端点（E2E_SKIP_AUTH 已登录态）: GET/PUT/DELETE config, POST test, POST push, GET history, pull-key CRUD | ~15 |
| `e2e/api/backup-pull.test.ts` | Pull webhook: HEAD 200/401 (key 认证, 不依赖 session), POST 200/401/422 | ~5 |

> 注意: L2 在 `E2E_SKIP_AUTH=true` 环境下运行，无法测试 OAuth 401。OAuth 鉴权规则的正确性由 L1 `proxy.test.ts` 保证。Pull webhook 的 key 认证不受 `E2E_SKIP_AUTH` 影响（在 route handler 内部校验），可以在 L2 测试 401。

### 13.3 L3 — Browser E2E (按需)

| 文件 | 覆盖内容 | 预估 specs |
|------|----------|-----------|
| `e2e/browser/backup.spec.ts` | 完整用户流程: 打开页面 → 填写配置 → 保存 → 测试连接 → 编辑/取消 → Pull webhook CRUD | ~10 |

### 13.4 G1 — Static Analysis (pre-commit)

- 所有新文件通过 `tsc --noEmit` (strict mode)
- 所有新文件通过 `eslint --max-warnings=0` (tseslint strict)

### 13.5 G2 — Security (pre-push)

- `osv-scanner` 通过（无新依赖引入，仅使用 `node:zlib` 和 `node:crypto` 内置模块）
- `gitleaks` 通过（确保测试中不硬编码真实 token）

### 13.6 D1 — Test Isolation

- API E2E 使用独立的测试 D1 数据库（现有 `firefly-db-test` 实例）
- Pull webhook 测试中 mock Backy 远程调用（不实际访问 Backy 服务）
- Push 测试中 mock `fetch` 调用（不实际上传到 Backy）

---

## 十四、文件清单

### 14.1 新增文件

```
scripts/migrations/010-backup.sql            # DB migration
src/models/backup.ts                         # Types + pure functions
src/models/backup.server.ts                  # Server-only crypto
src/models/backup-schema.ts                  # Envelope + Exported types
src/data/backup.ts                           # Backy config CRUD
src/data/backup-export.ts                    # Data collection + serialization + compression
src/app/admin/backup/page.tsx                # SSR page
src/app/api/backup/route.ts                  # Config CRUD (GET/PUT/DELETE)
src/app/api/backup/test/route.ts             # Test connection (POST)
src/app/api/backup/push/route.ts             # Push backup (POST)
src/app/api/backup/history/route.ts          # Backup history (GET)
src/app/api/backup/pull/route.ts             # Pull webhook (HEAD/POST)
src/app/api/backup/pull-key/route.ts         # Pull key CRUD (GET/POST/DELETE)
src/components/admin/backup-page.tsx         # Client component
src/models/backup.test.ts                    # L1 (colocated)
src/models/backup-schema.test.ts             # L1 (colocated)
src/data/backup.test.ts                      # L1 (colocated)
src/data/backup-export.test.ts               # L1 (colocated)
src/proxy.test.ts                            # L1 (auth guard, highest priority)
e2e/api/backup.test.ts                       # L2
e2e/api/backup-pull.test.ts                  # L2
e2e/browser/backup.spec.ts                   # L3
```

### 14.2 修改文件

```
src/components/admin/sidebar.tsx             # 新增 Backup 导航项
src/proxy.ts                                 # /api/backup 全方法保护 + /api/backup/pull 豁免
src/i18n/locales/zh.json                     # 新增 backup 相关翻译
src/i18n/locales/en.json                     # 新增 backup 相关翻译
```

---

## 十五、原子化提交计划

| # | Commit | 内容 | 测试 |
|---|--------|------|------|
| 1 | `feat(db): add backup settings migration` | `010-backup.sql` + apply | 手动验证 |
| 2 | `feat(backup): add model types and pure functions` | `models/backup.ts` + `models/backup.server.ts` + `models/backup-schema.ts` | L1: `backup-model.test.ts` + `backup-schema.test.ts` |
| 3 | `feat(backup): add data layer for config and export` | `data/backup.ts` + `data/backup-export.ts` | L1: `backup-data.test.ts` + `backup-export.test.ts` |
| 4 | `feat(backup): protect /api/backup routes in proxy` | `proxy.ts` 新增 `/api/backup` 全方法保护 + `/api/backup/pull` 精确豁免 + 导出 `_testHelpers` | L1: `src/proxy.test.ts`（鉴权规则先于 route 实现，确保屏障到位） |
| 5 | `feat(backup): add config and test API routes` | `api/backup/route.ts` + `api/backup/test/route.ts` | L2: config CRUD tests |
| 6 | `feat(backup): add push and history API routes` | `api/backup/push/route.ts` + `api/backup/history/route.ts` | L2: push + history tests |
| 7 | `feat(backup): add pull webhook endpoint` | `api/backup/pull/route.ts` + `api/backup/pull-key/route.ts` | L2: `backup-pull.test.ts` |
| 8 | `feat(backup): add admin page and sidebar nav` | `app/admin/backup/page.tsx` + `components/admin/backup-page.tsx` + sidebar 修改 + i18n | L3: `backup.spec.ts` |
| 9 | `docs: add 16-backy-backup design document` | 本文档 | — |

---

## 十六、风险与缓解

| 风险 | 缓解 |
|------|------|
| GET /api/backup/* 未登录泄露敏感数据 | proxy.ts 将 `/api/backup` 前缀（除精确 `/api/backup/pull`）整体设为全方法受保护；L1 `proxy.test.ts` 验证保护矩阵 |
| 备份 JSON 过大（文章含 HTML cache） | gzip 压缩，Backy 限制 50MB |
| D1 并行查询可能触发 7429 超时 | 现有 D1 客户端已内置指数退避重试 |
| 同一天/同秒多次推送文件名冲突 | 文件名秒级时间戳 + 4 位随机后缀（`nanoid(4)`） |
| 导出 JSON 字段顺序不稳定 | 每张表 SELECT 显式 ORDER BY 主键 |
| Push 成功但 History 拉取超时 | 定义为部分成功：`ok=true` + `history=undefined`，UI 仍显示推送成功 |
| `site_settings` 未来新增敏感列意外泄露 | SELECT 列白名单（非 `SELECT *` 后删除），新增列默认不备份 |
| Pull key 泄露导致未授权推送 | UUID v4 足够随机；UI 提供一键撤销/重新生成 |
| Schema 演进（未来新增表/列） | `schemaVersion` 字段支持向前兼容，恢复时可据此判断 |
| `content_html` 可从 `content` 重建 | 仍然备份以加速恢复，但标记为可选 |
