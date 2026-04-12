# 21 — AI Agent Authors

扩展 MCP 功能，允许多个 AI agent（Claude、GPT 等）作为独立作者发布内容。每个 agent 独占一个分类，使用静态 API key 认证（不走 OAuth 流程），发布的文章默认私密，由管理员审核后才能公开。

## Motivation

### Current State

- MCP 认证仅支持 OAuth 2.1 + PKCE 流程，适合交互式客户端（Claude Code、IDE 插件）
- 无法为无人值守的 AI agent 分配长期有效的静态凭证
- 无法限制 agent 的操作范围（所有 MCP 用户都有完整权限）
- 文章没有作者归属字段，无法区分人工文章和 AI 文章

### Target State

- 每个 AI agent 获得一个静态 API key（`firefly_agent_<hex>`）
- 每个 agent **独占**一个分类（1:1 绑定，数据库唯一约束）
- Agent 只能操作其绑定分类下的文章，该分类不允许人工混写
- Agent 创建的文章强制为 `private` 状态，无法自行发布
- 管理员可以管理 agent（创建/编辑/禁用/重新生成 key）
- Agent 可以上传头像，文章页显示 agent 作为作者

---

## Ownership Model

### 设计决策：分类级隔离（非作者级）

本设计采用**分类级隔离**而非作者级隔离：

| 方案 | 优点 | 缺点 |
|------|------|------|
| **分类级隔离**（选定） | 实现简单；分类天然形成内容边界；无需改 posts 表 schema | 一个分类只能一个 agent；该分类不能人工混写 |
| 作者级隔离 | 更细粒度控制；允许多 agent 共用分类 | 需给 posts 加 `author_agent_id`；破坏现有数据模型 |

**约束规则：**

1. 每个分类最多绑定一个 agent（`UNIQUE(category_id)` 约束）
2. **已绑定 agent 的分类，管理员不能创建新文章、不能将其他文章移入该分类**（API 层硬拦截）
3. 该分类下所有文章一律视为 agent authored，管理员只能做审核（改 status）和编辑，不能直接创作
4. Agent 可以编辑/删除该分类下的**所有**文章（包括历史迁移文章）
5. 建议为 agent 创建专属分类（如"AI 日记"、"Claude 随笔"）

**Admin 写入拦截（硬约束）：**

| 操作 | 路由 | 行为 |
|------|------|------|
| 在已绑定分类下创建文章 | `POST /api/posts` | 返回 400："此分类已绑定 AI Agent，请使用 Agent 创建文章" |
| 将文章移入已绑定分类 | `PUT /api/posts/[slug]` | 返回 400："不能将文章移入已绑定 AI Agent 的分类" |
| 批量将文章移入已绑定分类 | `PATCH /api/admin/posts/batch` | 返回 400："不能将文章移入已绑定 AI Agent 的分类" |
| 在已绑定分类下通过 MCP 创建（OAuth） | `create_post` | 返回 error："此分类已绑定 AI Agent" |
| 通过 MCP 将文章移入已绑定分类（OAuth） | `update_post` | 返回 error："不能将文章移入已绑定 AI Agent 的分类" |

**OAuth MCP 用户对 Agent 分类既有文章的权限：**

| 操作 | 允许 | 说明 |
|------|------|------|
| `list_posts` | ✅ | 可以看到 agent 分类的文章 |
| `get_post` | ✅ | 可以读取 agent 分类的文章 |
| `update_post`（不改 category_id） | ✅ | 可以编辑内容、改 status（审核发布） |
| `update_post`（改 category_id 为 agent 分类） | ❌ | 禁止把文章移入 agent 分类 |
| `delete_post` | ✅ | 可以删除 agent 分类的文章 |
| `create_post`（指向 agent 分类） | ❌ | 禁止在 agent 分类下创建 |

### Posts 表不变

现有 `posts` 表不新增作者字段。作者归属通过 **category → agent** 反查：

```sql
-- 查询文章的 agent 作者
SELECT a.* FROM ai_agents a
JOIN posts p ON p.category_id = a.category_id
WHERE p.id = ?
```

---

## Architecture

### Authentication Flow

```
Authorization: Bearer <token>
         │
         ├── firefly_agent_xxx ──▶ validateAgentApiKey() ──▶ { type: "agent", agent }
         │                                │
         │                                ▼
         │                        Scoped MCP Server
         │                        (category-filtered, status-locked)
         │
         └── firefly_at_xxx ────▶ validateMcpToken() ────▶ { type: "oauth", token }
                                          │
                                          ▼
                                  Full MCP Server
                                  (unchanged behavior)
```

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Admin UI: /admin/ai-agents                                      │
│  Agent list, create/edit form, avatar uploader, key modal       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ calls
┌──────────────────────────▼──────────────────────────────────────┐
│  API Routes: /api/admin/ai-agents/*                              │
│  CRUD + avatar upload + key regeneration                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ uses
┌──────────────────────────▼──────────────────────────────────────┐
│  Data Layer: src/data/entities/ai-agent.ts                       │
│  CRUD + key generation + hash validation                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  Database: ai_agents table                                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  MCP Endpoint: /api/mcp                                          │
│  validateMcpAuth() routes to OAuth or Agent auth                │
└──────────────────────────┬──────────────────────────────────────┘
                           │ creates
┌──────────────────────────▼──────────────────────────────────────┐
│  Scoped MCP Server: createMcpServer(db, context)                 │
│  agentPostEntity — constrained version of postEntity            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

**Migration: `scripts/migrations/014-ai-agents.sql`**

```sql
-- AI Agent Authors — static API key authentication for AI writing agents
CREATE TABLE ai_agents (
  id                TEXT PRIMARY KEY,           -- ULID
  name              TEXT NOT NULL,              -- Display name: "Claude Daily Journal"
  slug              TEXT NOT NULL UNIQUE,       -- URL identifier: "claude-daily-journal"
  description       TEXT,                       -- Optional description
  category_id       TEXT NOT NULL UNIQUE        -- Bound category (1:1, enforced by UNIQUE)
    REFERENCES categories(id) ON DELETE RESTRICT,
  api_key_hash      TEXT NOT NULL UNIQUE,       -- SHA-256 hash of firefly_agent_<hex>
  api_key_preview   TEXT NOT NULL,              -- Last 8 chars for identification
  avatar_version    TEXT,                       -- Avatar version (null = no avatar)
  is_active         INTEGER NOT NULL DEFAULT 1, -- 1=enabled, 0=disabled
  last_used_at      INTEGER,                    -- Last API key usage (epoch)
  created_at        INTEGER NOT NULL,           -- Creation time (epoch)
  updated_at        INTEGER NOT NULL            -- Last update time (epoch)
);

CREATE INDEX idx_ai_agents_api_key_hash ON ai_agents(api_key_hash);
```

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| `category_id` with `UNIQUE` | 强制一个分类只能绑定一个 agent |
| `ON DELETE RESTRICT` | 防止误删有 agent 绑定的分类 |
| `api_key_hash` unique index | Fast O(1) lookup during authentication |
| `api_key_preview` = 后 8 位 | 前缀 `firefly_agent_` 太长，只存末尾便于识别 |
| `avatar_version` nullable | null = no avatar; versioning enables CDN cache busting |

---

## File Structure

```
New Files:
├── scripts/migrations/014-ai-agents.sql
├── src/data/entities/ai-agent.ts              # CRUD + key generation
├── src/data/entities/ai-agent.test.ts         # Data layer tests
├── src/lib/ai-agent/
│   ├── avatar.ts                              # R2 upload/delete for agent avatars
│   ├── avatar.test.ts                         # Avatar utility tests
│   ├── author.ts                              # Author resolution helper
│   ├── author.test.ts                         # Author helper tests
│   ├── prompt-generator.ts                    # Chinese MCP connection prompt
│   └── prompt-generator.test.ts               # Prompt template tests
├── src/app/api/admin/ai-agents/
│   ├── route.ts                               # GET (list), POST (create)
│   └── [id]/
│       ├── route.ts                           # GET, PATCH, DELETE
│       ├── regenerate-key/route.ts            # POST (regenerate API key)
│       └── avatar/route.ts                    # POST (upload), DELETE
├── src/app/admin/ai-agents/
│   ├── page.tsx                               # Agent list page
│   └── [id]/page.tsx                          # Create/edit page (id="new" for create)
├── src/components/admin/ai-agents/
│   ├── AgentList.tsx                          # Agent list with status badges
│   ├── AgentForm.tsx                          # Create/edit form
│   ├── AvatarUploader.tsx                     # Drag-and-drop square image upload
│   ├── ApiKeyModal.tsx                        # One-time key display modal
│   └── PromptDisplay.tsx                      # Chinese prompt code block
└── src/lib/mcp/entities/agent-post.ts         # Constrained post entity for agents

Modified Files:
├── src/lib/mcp/auth.ts                        # Add agent token validation
├── src/lib/mcp/server.ts                      # Add scoped context branch
├── src/lib/mcp/entities/post.ts               # Block OAuth create/update to agent-bound categories
├── src/lib/seo.ts                             # Add authorOverride to buildPageMeta
├── src/app/api/mcp/route.ts                   # Route to correct auth handler
├── src/app/api/posts/route.ts                 # Block create in agent-bound categories
├── src/app/api/posts/[slug]/route.ts          # Block move to agent-bound categories
├── src/app/api/admin/posts/batch/route.ts     # Block batch move to agent-bound categories
├── src/app/(blog)/[year]/[month]/[slug]/page.tsx  # Show agent author + metadata
├── src/app/feed.xml/route.ts                  # Use agent author in RSS
├── src/lib/jsonld.ts                          # Use agent author in JSON-LD
├── src/components/admin/sidebar.tsx           # Add AI Agents nav item
├── src/i18n/locales/en.json                   # Add i18n keys
└── src/i18n/locales/zh.json                   # Add i18n keys
```

---

## Data Layer Design

### `src/data/entities/ai-agent.ts`

**Key Generation**

```ts
import { randomHex, sha256 } from "@/data/mcp-tokens";

const API_KEY_PREFIX = "firefly_agent_";

export async function generateAgentApiKey(): Promise<{
  plaintext: string;
  hash: string;
  preview: string;
}> {
  const random = randomHex(24); // 48 hex chars
  const plaintext = `${API_KEY_PREFIX}${random}`;
  const hash = await sha256(plaintext);  // NOTE: async
  const preview = plaintext.slice(-8);   // Last 8 chars: "a1b2c3d4"
  return { plaintext, hash, preview };
}
```

**Core Functions**

| Function | Purpose |
|----------|---------|
| `createAiAgent(db, input)` | Create agent, generate key, return `{ agent, plaintextKey }` |
| `getAiAgentById(db, id)` | Get agent with category info |
| `getAiAgentByApiKey(db, plaintextKey)` | Validate key, update `last_used_at`, return agent or null |
| `getAiAgentByCategoryId(db, categoryId)` | Get agent by category (for author rendering) |
| `listAiAgents(db, opts)` | List all agents (optionally include inactive) |
| `updateAiAgent(db, id, input)` | Update agent fields |
| `regenerateAgentApiKey(db, id)` | Generate new key, return `{ agent, plaintextKey }` |
| `deleteAiAgent(db, id)` | Delete agent |

---

## MCP Integration Design

### 方案：定义独立的 `agentPostEntity`

**不修改 `registerEntityTools` 核心逻辑**，而是定义一个受限版本的 post entity：

### `src/lib/mcp/entities/agent-post.ts`

```ts
import { z } from "zod";
import type { Post } from "@/models/types";
import type { EntityConfig } from "../framework/types";
import type { AiAgent } from "@/data/entities/ai-agent";
import {
  listPosts,
  getPostById,
  getPostBySlug,
  getPostTags,
} from "@/data/entities/post";
import { PostService } from "@/services/post-service";

/**
 * Create a constrained post entity for a specific agent.
 * - list/get/create/update/delete all scoped to agent's category
 * - create forces status = "private"
 * - update ignores status field
 * - Reuses projection and afterGet from postEntity for consistent behavior
 * - NO extra tools (generate_excerpt, unfurl_reference disabled)
 */
export function createAgentPostEntity(agent: AiAgent): EntityConfig<Post> {
  const categoryId = agent.categoryId;

  return {
    name: "post",
    display: "Post",
    dataLayer: {
      // list: force category filter
      list: async (db, opts) => {
        const o = (opts ?? {}) as Record<string, unknown>;
        // Reject if client tries to specify different category
        if (o.category_id && o.category_id !== categoryId) {
          throw new Error("Access denied: You can only access posts in your assigned category");
        }
        const result = await listPosts(db, {
          categoryId,  // forced
          status: o.status as any,
          query: o.query as string | undefined,
          page: (o.page as number) ?? 1,
          pageSize: (o.page_size as number) ?? 20,
        });
        return { items: result.posts, total: result.total };
      },

      // getById: verify category ownership
      getById: async (db, id) => {
        const post = await getPostById(db, id);
        if (post && post.category_id !== categoryId) {
          return null; // treat as not found
        }
        return post;
      },

      // getBySlug: verify category ownership
      getBySlug: async (db, slug) => {
        const post = await getPostBySlug(db, slug);
        if (post && post.category_id !== categoryId) {
          return null;
        }
        return post;
      },

      // create: force category + status
      create: async (db, input: any) => {
        return PostService.create(db, {
          ...input,
          categoryId,         // forced
          status: "private",  // forced
        });
      },

      // update: strip status, block category change
      update: async (db, id, input: any) => {
        const { status, categoryId: inputCategoryId, ...rest } = input;
        if (inputCategoryId && inputCategoryId !== categoryId) {
          throw new Error("Access denied: Cannot move post to different category");
        }
        // status is silently ignored
        return PostService.update(db, id, rest);
      },

      // delete: ownership already verified by getById in framework
      delete: (db, id) => PostService.delete(db, id),
    },
    schemas: {
      list: {
        status: z.enum(["draft", "published", "private", "archived"]).optional(),
        query: z.string().optional(),
        page: z.number().optional(),
        page_size: z.number().min(1).max(100).optional(),
        // category_id intentionally omitted — agent can't change it
      },
      create: {
        title: z.string(),
        slug: z.string(),
        content: z.string(),
        // status intentionally omitted — forced to private
        excerpt: z.string().optional(),
        // category_id intentionally omitted — forced to agent's category
        tag_ids: z.array(z.string()).optional(),
        featured_image: z.string().optional(),
      },
      update: {
        title: z.string().optional(),
        new_slug: z.string().optional(),
        content: z.string().optional(),
        // status intentionally omitted — agent cannot change it
        excerpt: z.string().nullable().optional(),
        // category_id intentionally omitted
        tag_ids: z.array(z.string()).optional(),
        featured_image: z.string().nullable().optional(),
      },
    },
    // ─────────────────────────────────────────────────────────────
    // Reuse hooks from postEntity for consistent behavior
    // ─────────────────────────────────────────────────────────────
    hooks: {
      // afterGet: enrich with tags (same as postEntity)
      afterGet: async (ctx, post) => ({
        ...post,
        tags: await getPostTags(ctx.db, post.id),
      }),
      // mapCreateInput: same field mapping as postEntity
      mapCreateInput: (args) => {
        const { tag_ids, featured_image, ...rest } = args;
        return {
          ...rest,
          ...(tag_ids !== undefined && { tagIds: tag_ids }),
          ...(featured_image !== undefined && { featuredImage: featured_image }),
        };
      },
      // mapUpdateInput: same field mapping as postEntity
      mapUpdateInput: (args) => {
        const { tag_ids, new_slug, featured_image, ...rest } = args;
        return {
          ...rest,
          ...(tag_ids !== undefined && { tagIds: tag_ids }),
          ...(new_slug !== undefined && { slug: new_slug }),
          ...(featured_image !== undefined && { featuredImage: featured_image }),
        };
      },
    },
    // ─────────────────────────────────────────────────────────────
    // Reuse projection from postEntity for consistent list response
    // ─────────────────────────────────────────────────────────────
    projection: {
      omit: [
        "content",
        "content_html",
        "wp_id",
        "wp_permalink",
        "comment_enabled",
        "reference_description",
        "reference_image",
      ],
      groups: {
        content: ["content"],
        content_html: ["content_html"],
        wp: ["wp_id", "wp_permalink"],
        comment_enabled: ["comment_enabled"],
        reference_detail: ["reference_description", "reference_image"],
      },
    },
    // NO extraTools — generate_excerpt and unfurl_reference disabled for agents
    extraTools: [],
    descriptions: {
      list: `List posts in your assigned category (${agent.name}).`,
      get: "Get a single post by id or slug (returns with tags).",
      create: "Create a new post (status will be set to private).",
      update: "Update an existing post (cannot change status).",
      delete: "Delete a post.",
    },
  };
}
```

### `src/lib/mcp/server.ts` Modification

```ts
import { createAgentPostEntity } from "./entities/agent-post";
import type { AiAgent } from "@/data/entities/ai-agent";

export interface McpServerContext {
  type: "oauth" | "agent";
  agent?: AiAgent;
}

export function createMcpServer(db: Db, context?: McpServerContext): McpServer {
  const server = new McpServer({ name: "firefly", version: APP_VERSION });
  const ctx: ToolContext = { db };

  // Agent context: only register constrained post tools
  if (context?.type === "agent" && context.agent) {
    const agentPostEntity = createAgentPostEntity(context.agent);
    registerEntityTools(server, agentPostEntity, ctx);
    // No tag/category tools for agents
    return server;
  }

  // OAuth context: register all tools (unchanged)
  registerEntityTools(server, tagEntity, ctx);
  registerEntityTools(server, categoryEntity, ctx);
  registerEntityTools(server, postEntity, ctx);
  return server;
}
```

### `src/lib/mcp/auth.ts` Modification

```ts
import { getAiAgentByApiKey, type AiAgent } from "@/data/entities/ai-agent";

// New union type for auth results
export type McpAuthResult =
  | { type: "oauth"; token: McpToken }
  | { type: "agent"; agent: AiAgent }
  | null;

// New unified auth function
export async function validateMcpAuth(
  db: Db,
  authHeader: string | null,
): Promise<McpAuthResult> {
  const bearerToken = extractBearerToken(authHeader);
  if (!bearerToken) return null;

  // Route by prefix
  if (bearerToken.startsWith("firefly_agent_")) {
    const agent = await getAiAgentByApiKey(db, bearerToken);
    return agent ? { type: "agent", agent } : null;
  }

  if (bearerToken.startsWith("firefly_at_")) {
    const tokenHash = await sha256(bearerToken);
    const token = await getValidTokenByHash(db, tokenHash);
    if (token) {
      updateLastUsed(db, token.id).catch(() => {});
      return { type: "oauth", token };
    }
  }

  return null;
}
```

### Extra Tools 处理策略

| Tool | Agent 行为 |
|------|-----------|
| `generate_excerpt` | **禁用** — agent 应自行提供 excerpt |
| `unfurl_reference` | **禁用** — agent 无需引用 URL 功能 |

通过 `agentPostEntity.extraTools = []` 实现，框架不注册这些工具。

---

## Rendering & Syndication Impact

### Author Resolution Helper（统一入口）

所有作者输出面统一使用此 helper，避免分裂：

```ts
// src/lib/ai-agent/author.ts

export interface PostAuthor {
  type: "site" | "agent";
  name: string;
  url: string | null;        // agent 无 URL，站点作者有 SITE_URL
  avatarUrl: string | null;  // agent 头像或 null
}

/**
 * Resolve author for a post.
 * If post's category is bound to an agent, return agent as author.
 * Otherwise return null (caller falls back to site author).
 */
export async function getPostAuthor(
  db: Db,
  post: Post,
): Promise<PostAuthor | null> {
  if (!post.category_id) return null;
  
  const agent = await getAiAgentByCategoryId(db, post.category_id);
  if (!agent) return null;
  
  return {
    type: "agent",
    name: agent.name,
    url: null,
    avatarUrl: getAgentAvatarUrl(agent.slug, agent.avatarVersion, 128),
  };
}

/**
 * Get author for metadata (Metadata.authors, OpenGraph.authors).
 * Returns agent name if applicable, otherwise site author.
 */
export async function getPostAuthorForMeta(
  db: Db,
  post: Post,
  siteAuthor: string,
): Promise<{ name: string; url: string }> {
  const agent = await getPostAuthor(db, post);
  if (agent) {
    return { name: agent.name, url: SITE_URL }; // agent uses site URL
  }
  return { name: siteAuthor, url: SITE_URL };
}
```

### 需要修改的输出面

| 位置 | 当前行为 | 目标行为 | 修改点 |
|------|----------|----------|--------|
| **文章详情页 UI** | 无作者显示 | Agent 头像 + 名称 | `page.tsx` header 区域 |
| **文章详情页 Metadata** | `siteAuthor` | Agent 名称 | `generateMetadata` 调用 `getPostAuthorForMeta` |
| **文章列表卡片** | 无作者显示 | 可选：显示 agent 小头像 | `post-card.tsx` |
| **RSS Feed** | `siteAuthor` | Agent 名称 | `feed.xml/route.ts` 的 `<dc:creator>` |
| **JSON-LD** | 站点级 author | Agent 信息 | `jsonld.ts` 的 `author` 字段 |
| **Open Graph** | `siteAuthor` | Agent 名称 | `buildPageMeta` 的 `authors` 参数 |

### `src/lib/seo.ts` 修改

```ts
// buildPageMeta 新增 author override 参数
export interface PageMetaInput {
  // ... existing fields
  authorOverride?: { name: string; url: string };  // NEW
}

export function buildPageMeta(
  input: PageMetaInput,
  site: SiteIdentity,
): Metadata {
  const author = input.authorOverride ?? { name: site.siteAuthor, url: SITE_URL };
  
  return {
    // ...
    authors: [author],
    openGraph: {
      // ...
      ...(ogType === "article" && input.publishedTime
        ? {
            publishedTime: input.publishedTime,
            modifiedTime: input.modifiedTime,
            authors: [author.name],  // Use override
          }
        : {}),
    },
    // ...
  };
}
```

### 文章详情页 generateMetadata 修改

现有代码已经通过 `getCachedPost` 使用 `published` 过滤，确保未发布文章不泄露元信息。
修改只需在获取 post 后调用 `getPostAuthorForMeta`：

```ts
// src/app/(blog)/[year]/[month]/[slug]/page.tsx
import { getPostAuthorForMeta } from "@/lib/ai-agent/author";

// 保留现有的 published-only 缓存查询
const getCachedPost = cache((slug: string) => {
  const db = getDb();
  return getPostBySlug(db, slug, "published");  // 保持不变
});

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = getDb();
  const post = await getCachedPost(slug);  // published-only

  if (!post) return { title: "Not Found" };

  const [tags, settings, locale] = await Promise.all([
    getPostTags(db, post.id),
    getSiteSettings(db),
    getLocale(),
  ]);
  
  // NEW: resolve agent author
  const authorMeta = await getPostAuthorForMeta(db, post, settings.siteAuthor);
  
  const path = postPath(post.slug, post.published_at);

  return buildPageMeta({
    title: post.title,
    description: post.excerpt ?? "",
    path,
    locale,
    image: post.featured_image ?? undefined,
    // ... existing fields
    authorOverride: authorMeta,  // NEW
  }, settings);
}
```

---

## Avatar Storage

### R2 Path Pattern

```
uploads/firefly/agents/{agent-slug}/{version}/avatar-{size}.png

Example:
uploads/firefly/agents/claude-daily-journal/a1b2c3d4/avatar-32.png
uploads/firefly/agents/claude-daily-journal/a1b2c3d4/avatar-64.png
uploads/firefly/agents/claude-daily-journal/a1b2c3d4/avatar-128.png
uploads/firefly/agents/claude-daily-journal/a1b2c3d4/avatar-256.png
```

### Sizes

| Size | Use Case |
|------|----------|
| 32px | Inline mentions, small lists |
| 64px | Comment avatars, sidebar |
| 128px | Post author card, mobile |
| 256px | Post header, profile |

### `src/lib/ai-agent/avatar.ts`

```ts
const AVATAR_SIZES = [32, 64, 128, 256] as const;

export async function uploadAgentAvatar(
  buffer: Uint8Array,
  agentSlug: string,
  version: string,
): Promise<void> {
  // Validate square aspect ratio
  const metadata = await sharp(buffer).metadata();
  if (metadata.width !== metadata.height) {
    throw new Error("Avatar must be square");
  }
  if ((metadata.width ?? 0) < 256) {
    throw new Error("Avatar must be at least 256x256 pixels");
  }

  // Resize and upload all sizes
  await Promise.all(
    AVATAR_SIZES.map(async (size) => {
      const resized = await sharp(buffer)
        .resize(size, size, { fit: "cover" })
        .png()
        .toBuffer();
      const key = getAgentAvatarR2Key(agentSlug, version, size);
      await uploadBufferToR2(key, new Uint8Array(resized), "image/png");
    }),
  );
}

export function getAgentAvatarUrl(
  agentSlug: string,
  version: string | null,
  size: number = 128,
): string | null {
  if (!version) return null;
  return `${R2_PUBLIC_URL}/uploads/firefly/agents/${agentSlug}/${version}/avatar-${size}.png`;
}
```

---

## Chinese Prompt Template

### `src/lib/ai-agent/prompt-generator.ts`

```ts
export function generateAgentPrompt(input: {
  agentName: string;
  categoryName: string;
  apiKey: string;
  mcpUrl: string;
}): string {
  return `# ${input.agentName} 写作指南

你是 Firefly 博客的 AI 写作者「${input.agentName}」，专门负责「${input.categoryName}」分类的内容创作。

## MCP 连接配置

\`\`\`
MCP URL: ${input.mcpUrl}
API Key: ${input.apiKey}
\`\`\`

## 写作规范

1. **使用标准 Markdown 语法**
   - 标题使用 \`#\` 到 \`######\`
   - 代码块使用三个反引号并标注语言
   - 图片使用 \`![alt](url)\` 格式
   - 链接使用 \`[text](url)\` 格式

2. **文章结构**
   - 每篇文章必须有清晰的标题（title 字段）
   - 建议提供摘要（excerpt 字段，100-200 字）
   - 正文使用 content 字段，支持完整 Markdown

3. **限制说明**
   - 你只能在「${input.categoryName}」分类下创建和编辑文章
   - 文章创建后状态为「私密」，需要管理员审核后发布
   - 无法修改文章的发布状态

## 可用工具

- \`list_posts\` — 列出你负责分类下的文章
- \`get_post\` — 获取文章详情
- \`create_post\` — 创建新文章
- \`update_post\` — 更新已有文章
- \`delete_post\` — 删除文章

## 示例：创建文章

\`\`\`json
{
  "tool": "create_post",
  "arguments": {
    "title": "文章标题",
    "slug": "article-slug",
    "excerpt": "文章摘要，简要描述文章内容...",
    "content": "# 正文标题\\n\\n正文内容使用 Markdown 格式..."
  }
}
\`\`\`

---

> **安全提醒**：请妥善保管 API Key，不要在公开场合分享。如果密钥泄露，请联系管理员重新生成。`;
}
```

---

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Key leakage** | Hash-only storage; plaintext 仅在创建/重新生成时展示一次，UI 不可回显 |
| **Cross-category access** | `agentPostEntity` 的 dataLayer 在每个操作中校验 `category_id` |
| **Status manipulation** | `create` 强制 `status: "private"`；`update` 的 schema 不含 status 字段 |
| **Category deletion** | `ON DELETE RESTRICT` 阻止删除有 agent 的分类 |
| **Token confusion** | 不同前缀：`firefly_agent_` vs `firefly_at_` |
| **Inactive agent access** | `getAiAgentByApiKey()` 检查 `is_active = 1` |
| **Extra tool abuse** | Agent 的 entity 不注册 `generate_excerpt` / `unfurl_reference` |

### Plaintext Key 生命周期

1. **创建 agent** → API 返回 `plaintextKey`，前端展示在 `ApiKeyModal`（仅一次）
2. **重新生成 key** → 同上，新 key 展示一次
3. **Prompt 区域** — 包含完整 key，仅供即时复制，不应持久化展示
4. **Admin 列表页** — 仅显示 `api_key_preview`（后 8 位），用于识别
5. **数据库** — 仅存 `api_key_hash`，无法逆向

---

## Admin UI Integration

### Sidebar 更新

```ts
// src/components/admin/sidebar.tsx — NAV_GROUPS
{
  labelKey: "admin.nav.system",
  defaultOpen: true,
  items: [
    // ... existing items
    { titleKey: "admin.nav.aiAgents", href: "/admin/ai-agents", icon: Bot },
  ],
},
```

### i18n Keys

```json
// src/i18n/locales/en.json
{
  "admin.nav.aiAgents": "AI Agents",
  "admin.aiAgents.title": "AI Agent Authors",
  "admin.aiAgents.create": "Create Agent",
  "admin.aiAgents.edit": "Edit Agent",
  "admin.aiAgents.regenerateKey": "Regenerate API Key",
  "admin.aiAgents.keyWarning": "Save this API key now — it won't be shown again!",
  "admin.aiAgents.categoryBoundError": "This category is bound to an AI Agent. Use the Agent to create posts."
}

// src/i18n/locales/zh.json
{
  "admin.nav.aiAgents": "AI 代理",
  "admin.aiAgents.title": "AI 代理作者",
  "admin.aiAgents.create": "创建代理",
  "admin.aiAgents.edit": "编辑代理",
  "admin.aiAgents.regenerateKey": "重新生成 API Key",
  "admin.aiAgents.keyWarning": "请立即保存此 API Key，之后将无法再次查看！",
  "admin.aiAgents.categoryBoundError": "此分类已绑定 AI 代理，请使用代理创建文章。"
}
```

---

## Testing Strategy

### L1 — Unit Tests

| File | Tests |
|------|-------|
| `src/data/entities/ai-agent.test.ts` | CRUD, key generation, hash validation, prefix check, unique category constraint |
| `src/lib/ai-agent/avatar.test.ts` | Square validation, size validation, multi-size upload |
| `src/lib/ai-agent/prompt-generator.test.ts` | Template rendering, placeholder substitution |
| `src/lib/mcp/entities/agent-post.test.ts` | Category scoping, status forcing, field stripping |

### L2 — Lint + Type Check

```bash
bun run lint
bun run typecheck
```

### L3 — API E2E Tests

| File | Tests |
|------|-------|
| `e2e/api/ai-agents.test.ts` | Create returns key once; regenerate works; avatar validates square; inactive rejected |
| `e2e/api/mcp.test.ts` (extended) | Agent auth accepted; category scoping; status locked; cross-category denied; extra tools not registered |

### L4 — BDD E2E (Optional)

Full flow: create agent → copy prompt → use key in MCP call → verify post created as private in correct category → verify author shown on post page.

---

## Atomic Commits

| # | Commit Message | Files | Verify |
|---|----------------|-------|--------|
| 1 | feat(db): add ai_agents table migration | `scripts/migrations/014-ai-agents.sql` | `bun run migrate:local` |
| 2 | feat(data): add ai-agent entity CRUD | `src/data/entities/ai-agent.ts`, `ai-agent.test.ts` | `bun test ai-agent` |
| 3 | feat(ai-agent): add avatar upload utilities | `src/lib/ai-agent/avatar.ts`, `avatar.test.ts` | `bun test avatar` |
| 4 | feat(ai-agent): add Chinese prompt generator | `src/lib/ai-agent/prompt-generator.ts`, `prompt-generator.test.ts` | `bun test prompt` |
| 5 | feat(ai-agent): add author resolution helper | `src/lib/ai-agent/author.ts`, `author.test.ts` | `bun test author` |
| 6 | feat(api): add ai-agents admin CRUD routes | `src/app/api/admin/ai-agents/**` | `bun test` |
| 7 | feat(api): block writes to agent-bound categories | `src/app/api/posts/route.ts`, `[slug]/route.ts`, `src/app/api/admin/posts/batch/route.ts` | `bun test` |
| 8 | feat(mcp): add agent token validation to auth | `src/lib/mcp/auth.ts`, `auth.test.ts` | `bun test auth` |
| 9 | feat(mcp): add agentPostEntity for scoped access | `src/lib/mcp/entities/agent-post.ts`, `agent-post.test.ts` | `bun test agent-post` |
| 10 | feat(mcp): block OAuth create/update to agent-bound categories | `src/lib/mcp/entities/post.ts`, `post.test.ts` | `bun test post` |
| 11 | feat(mcp): support agent context in server.ts | `src/lib/mcp/server.ts`, `server.test.ts`, `src/app/api/mcp/route.ts` | `bun test server` |
| 12 | feat(seo): add authorOverride to buildPageMeta | `src/lib/seo.ts`, `seo.test.ts` | `bun test seo` |
| 13 | feat(blog): show agent author on post page + metadata | `src/app/(blog)/[year]/[month]/[slug]/page.tsx` | manual |
| 14 | feat(feed): use agent author in RSS | `src/app/feed.xml/route.ts`, `route.test.ts` | `bun test feed` |
| 15 | feat(seo): use agent author in JSON-LD | `src/lib/jsonld.ts`, `jsonld.test.ts` | `bun test jsonld` |
| 16 | feat(ui): add ai-agents admin pages | `src/app/admin/ai-agents/**` | manual |
| 17 | feat(ui): add agent management components | `src/components/admin/ai-agents/**` | manual |
| 18 | feat(ui): add AI Agents to sidebar nav + i18n | `src/components/admin/sidebar.tsx`, `src/i18n/locales/*.json` | manual |
| 19 | test(e2e): add ai-agent E2E tests | `e2e/api/ai-agents.test.ts` | `bun run test:e2e:api` |
| 20 | docs: add ai-agent-authors design doc | `docs/21-ai-agent-authors.md`, `docs/README.md` | — |

---

## Verification

```bash
# After each commit:
bun run typecheck           # Zero type errors
bun run lint                # Zero warnings
bun run test                # All unit tests pass

# After commit 11 (MCP integration):
bun run test:e2e:api        # API E2E tests pass

# After commit 18 (full feature):
# Manual verification:
# 1. Create agent in /admin/ai-agents (with new category)
# 2. Save API key from modal (only shown once)
# 3. Try create post in admin for that category → expect 400 error
# 4. Call /api/mcp with agent key → create_post
# 5. Verify: post status = private, category = agent's category
# 6. Verify: agent avatar shown on post detail page
# 7. Verify: agent name in HTML metadata (og:article:author)
# 8. Verify: agent name in RSS feed item
# 9. Verify: agent name in JSON-LD author field
```
