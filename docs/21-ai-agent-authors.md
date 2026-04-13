# 21 — AI Agent Authors

扩展 MCP 功能，允许多个 AI agent（Claude、GPT 等）作为独立作者发布内容。每个 agent 绑定一个分类（同一分类可有多个 agent），使用静态 API key 认证（不走 OAuth 流程），发布的文章默认私密，由管理员审核后才能公开。

## Motivation

### Current State

- MCP 认证仅支持 OAuth 2.1 + PKCE 流程，适合交互式客户端（Claude Code、IDE 插件）
- 无法为无人值守的 AI agent 分配长期有效的静态凭证
- 无法限制 agent 的操作范围（所有 MCP 用户都有完整权限）
- 文章没有作者归属字段，无法区分人工文章和 AI 文章

### Target State

- 每个 AI agent 获得一个静态 API key（`firefly_agent_<hex>`）
- 每个 agent 绑定一个分类（同一分类可有多个 agent）
- Agent 只能操作**自己创建的**文章（通过 `posts.ai_agent_id` 判断）
- Agent 创建的文章强制为 `private` 状态，无法自行发布
- 管理员可以管理 agent（创建/编辑/禁用/重新生成 key）
- Agent 可以上传头像，文章页显示 agent 作为作者

---

## Ownership Model

### 设计决策：ai_agent_id 级隔离

本设计采用**文章级作者标记**：

| 方案 | 优点 | 缺点 |
|------|------|------|
| 分类级隔离（旧方案） | 实现简单；分类天然形成内容边界 | 一个分类只能一个 agent；该分类不能人工混写 |
| **ai_agent_id 级隔离**（当前） | 细粒度控制；允许多 agent 共用分类；允许人类在同分类创作 | 需要 posts.ai_agent_id 字段 |

**当前规则：**

1. 同一分类可以有多个 agent（移除了 `UNIQUE(category_id)` 约束）
2. Agent 创建文章时自动设置 `ai_agent_id = agent.id`
3. Agent 只能查看/编辑/删除自己创建的文章（`ai_agent_id` 匹配）
4. 人类可以在任意分类创建文章（不设置 `ai_agent_id`）
5. 文章作者通过 `ai_agent_id` 直接 JOIN 查询，无需反向查找

### Posts 表字段

`posts` 表新增 `ai_agent_id` 字段：

```sql
-- Migration: 015-post-ai-agent.sql
ALTER TABLE posts ADD COLUMN ai_agent_id TEXT REFERENCES ai_agents(id) ON DELETE SET NULL;
CREATE INDEX idx_posts_ai_agent ON posts(ai_agent_id);
```

**作者查询：**

```sql
-- 查询文章作者信息（直接 JOIN）
SELECT p.*, a.name AS agent_name, a.slug AS agent_slug, a.avatar_version AS agent_avatar_version
FROM posts p
LEFT JOIN ai_agents a ON p.ai_agent_id = a.id
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
         │                        (ai_agent_id-filtered, status-locked)
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

**Migration: `scripts/migrations/014-ai-agents.sql` + `015-post-ai-agent.sql`**

```sql
-- AI Agent Authors — static API key authentication for AI writing agents
CREATE TABLE ai_agents (
  id                TEXT PRIMARY KEY,           -- ULID
  name              TEXT NOT NULL,              -- Display name: "Claude Daily Journal"
  slug              TEXT NOT NULL UNIQUE,       -- URL identifier: "claude-daily-journal"
  description       TEXT,                       -- Optional description
  category_id       TEXT NOT NULL               -- Bound category (multiple agents can share)
    REFERENCES categories(id) ON DELETE RESTRICT,
  api_key_hash      TEXT NOT NULL UNIQUE,       -- SHA-256 hash of firefly_agent_<hex>
  api_key_preview   TEXT NOT NULL,              -- Last 8 chars for identification
  avatar_version    TEXT,                       -- Avatar version (null = no avatar)
  is_active         INTEGER NOT NULL DEFAULT 1, -- 1=enabled, 0=disabled
  last_used_at      INTEGER,                    -- Last API key usage (epoch)
  created_at        INTEGER NOT NULL,           -- Creation time (epoch)
  updated_at        INTEGER NOT NULL            -- Last update time (epoch)
);

CREATE INDEX idx_ai_agents_category ON ai_agents(category_id);
CREATE INDEX idx_ai_agents_api_key_hash ON ai_agents(api_key_hash);

-- Posts 表添加 ai_agent_id 字段
ALTER TABLE posts ADD COLUMN ai_agent_id TEXT REFERENCES ai_agents(id) ON DELETE SET NULL;
CREATE INDEX idx_posts_ai_agent ON posts(ai_agent_id);
```

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| `category_id` **without** UNIQUE | 允许同一分类多个 agent |
| `posts.ai_agent_id` | 直接标记文章作者，细粒度权限控制 |
| `ON DELETE SET NULL` for ai_agent_id | DB 层允许孤儿文章（作者变匿名），但**应用层会先拦截** |
| `ON DELETE RESTRICT` for category_id | 防止误删有 agent 绑定的分类 |
| `api_key_hash` unique index | Fast O(1) lookup during authentication |
| `api_key_preview` = 后 8 位 | 前缀 `firefly_agent_` 太长，只存末尾便于识别 |
| `avatar_version` nullable | null = no avatar; versioning enables CDN cache busting |

### Agent 删除策略（应用层）

虽然 DB schema 定义了 `ON DELETE SET NULL`（为了数据完整性的 fallback），但**应用层在此之前就拦截删除**：

- 如果 agent 有任何文章引用（`posts.ai_agent_id = agent.id`），禁止删除
- API 返回 409 Conflict 并告知文章数量
- 管理员需先将相关文章删除或重新分配后才能删除 agent
- UI 层：删除按钮仅在 `is_active = 0` 且 `post_count = 0` 时显示

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
├── src/lib/seo.ts                             # Add authorOverride to buildPageMeta
├── src/app/api/mcp/route.ts                   # Route to correct auth handler
├── src/app/(blog)/[year]/[month]/[slug]/page.tsx  # Show agent author + metadata
├── src/app/feed.xml/route.ts                  # Use agent author in RSS
├── src/lib/jsonld.ts                          # Use agent author in JSON-LD
├── src/components/admin/sidebar.tsx           # Add AI Agents nav item
├── src/i18n/locales/en.json                   # Add i18n keys
├── src/i18n/locales/zh.json                   # Add i18n keys
├── src/models/types.ts                        # Add ai_agent_id to Post, PostWithAgent type
└── src/data/entities/post.ts                  # Add aiAgentId to CreatePostInput, VIEW_QUERY JOIN agent
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
| `getAiAgentById(db, id)` | Get agent by ID |
| `getAiAgentBySlug(db, slug)` | Get agent by slug |
| `getAiAgentByApiKey(db, plaintextKey)` | Validate key, update `last_used_at`, return agent or null |
| `listAiAgents(db, opts)` | List all agents with category info and post count |
| `updateAiAgent(db, id, input)` | Update agent fields |
| `regenerateAgentApiKey(db, id)` | Generate new key, return `{ agent, plaintextKey }` |
| `deleteAiAgent(db, id)` | Delete agent (blocked if has posts) |
| `getAiAgentPostCount(db, id)` | Get count of posts referencing this agent |

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
 * - list/get/update/delete all scoped to agent's own posts (ai_agent_id match)
 * - create forces status = "private", categoryId = agent's category, aiAgentId = agent.id
 * - update ignores status field
 * - Reuses projection and afterGet from postEntity for consistent behavior
 * - NO extra tools (generate_excerpt, unfurl_reference disabled)
 */
export function createAgentPostEntity(agent: AiAgent): EntityConfig<Post> {
  const categoryId = agent.category_id;
  const agentId = agent.id;

  return {
    name: "post",
    display: "Post",
    dataLayer: {
      // list: filter by agent's own posts
      list: async (db, opts) => {
        const o = (opts ?? {}) as Record<string, unknown>;
        const result = await listPosts(db, {
          aiAgentId: agentId,  // Only agent's own posts
          status: o.status as any,
          query: o.query as string | undefined,
          page: (o.page as number) ?? 1,
          pageSize: (o.page_size as number) ?? 20,
        });
        return { items: result.posts, total: result.total };
      },

      // getById: verify ai_agent_id ownership
      getById: async (db, id) => {
        const post = await getPostById(db, id);
        if (post && post.ai_agent_id !== agentId) {
          return null; // treat as not found
        }
        return post;
      },

      // getBySlug: verify ai_agent_id ownership
      getBySlug: async (db, slug) => {
        const post = await getPostBySlug(db, slug);
        if (post && post.ai_agent_id !== agentId) {
          return null;
        }
        return post;
      },

      // create: force category + status + aiAgentId
      create: async (db, input: any) => {
        return PostService.create(db, {
          ...input,
          categoryId,         // forced to agent's bound category
          status: "private",  // forced
          aiAgentId: agentId, // mark as agent's own post
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
      list: `List your own posts (filtered by ai_agent_id).`,
      get: "Get a single post by id or slug (returns with tags, must be your own).",
      create: "Create a new post (status will be set to private, category forced to your assigned category).",
      update: "Update an existing post (cannot change status, must be your own).",
      delete: "Delete a post (must be your own).",
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
  avatarUrl: string | null;  // agent 头像或站点 logo
}

/**
 * Resolve author for a post (synchronous, uses JOINed data).
 * If post has ai_agent_id, return agent as author.
 * Otherwise return site author.
 * 
 * IMPORTANT: This function is SYNCHRONOUS and requires PostWithAgent
 * (which includes agent_name, agent_slug, agent_avatar_version from JOIN).
 */
export function getPostAuthor(
  post: PostWithAgent,
  settings: { siteAuthor: string; siteLogoVersion: string | null },
): PostAuthor {
  if (post.ai_agent_id && post.agent_name) {
    // AI Agent 作品
    return {
      type: "agent",
      name: post.agent_name,
      avatarUrl: post.agent_avatar_version
        ? getAgentAvatarUrl(post.ai_agent_id, post.agent_avatar_version, 64)
        : null,
    };
  } else {
    // 人类作品
    return {
      type: "site",
      name: settings.siteAuthor,
      avatarUrl: settings.siteLogoVersion
        ? getLogoUrl(settings.siteLogoVersion, 64)
        : null,
    };
  }
}
```

**关键变化（相比旧的 async 版本）：**

1. **同步函数**：不再调用 `getAiAgentByCategoryId`，直接使用 JOINed 数据
2. **PostWithAgent 类型**：需要 `agent_name`, `agent_slug`, `agent_avatar_version` 字段
3. **双路径返回**：AI agent 文章返回 agent 信息，人类文章返回站点信息
4. **无数据库依赖**：所有数据来自已 JOIN 的 post 对象

### 需要修改的输出面

| 位置 | 当前行为 | 目标行为 | 修改点 |
|------|----------|----------|--------|
| **文章详情页 UI** | 无作者显示 | Agent 头像 + 名称 | `page.tsx` header 区域 |
| **文章详情页 Metadata** | `siteAuthor` | Agent 名称 | `generateMetadata` 调用 `getPostAuthor` |
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

现有代码 `getPostBySlug` 已通过 VIEW_QUERY 返回带 agent 信息的 `PostWithAgent` 类型。
修改只需调用同步的 `getPostAuthor`：

```ts
// src/app/(blog)/[year]/[month]/[slug]/page.tsx
import { getPostAuthor } from "@/lib/ai-agent/author";

// 现有查询已包含 agent JOIN
const getCachedPost = cache((slug: string) => {
  const db = getDb();
  return getPostBySlug(db, slug, "published");  // 返回 PostWithAgent
});

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = getDb();
  const post = await getCachedPost(slug);  // PostWithAgent 类型

  if (!post) return { title: "Not Found" };

  const [tags, settings, locale] = await Promise.all([
    getPostTags(db, post.id),
    getSiteSettings(db),
    getLocale(),
  ]);
  
  // 同步获取作者信息（无数据库调用）
  const author = getPostAuthor(post, {
    siteAuthor: settings.siteAuthor,
    siteLogoVersion: settings.siteLogoVersion,
  });
  
  const path = postPath(post.slug, post.published_at);

  return buildPageMeta({
    title: post.title,
    description: post.excerpt ?? "",
    path,
    locale,
    image: post.featured_image ?? undefined,
    // ... existing fields
    authorOverride: { name: author.name, url: SITE_URL },
  }, settings);
}
```

---

## Avatar Storage

### R2 Path Pattern

We use agent ID (not slug) in paths to ensure stability when slug changes.

```
uploads/firefly/agents/{agent-id}/{version}/avatar-{size}.png

Example:
uploads/firefly/agents/01HQ1234567890ABCDEF/a1b2c3d4/avatar-32.png
uploads/firefly/agents/01HQ1234567890ABCDEF/a1b2c3d4/avatar-64.png
uploads/firefly/agents/01HQ1234567890ABCDEF/a1b2c3d4/avatar-128.png
uploads/firefly/agents/01HQ1234567890ABCDEF/a1b2c3d4/avatar-256.png
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

// Note: Upload is handled in the avatar API route, not here.
// This module provides URL builders that use agent ID for stable paths.

export function getAgentAvatarUrl(
  agentId: string,
  version: string | null,
  size: number = 128,
): string | null {
  if (!version) return null;
  return `${R2_PUBLIC_URL}/uploads/firefly/agents/${agentId}/${version}/avatar-${size}.png`;
}

export function getAgentAvatarR2Key(
  agentId: string,
  version: string,
  size: AvatarSize,
): string {
  return `uploads/firefly/agents/${agentId}/${version}/avatar-${size}.png`;
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
   - 你只能操作自己创建的文章（按 ai_agent_id 隔离）
   - 创建文章时会自动归入「${input.categoryName}」分类
   - 文章创建后状态为「私密」，需要管理员审核后发布
   - 无法修改文章的发布状态

## 可用工具

- \`list_posts\` — 列出你自己创建的文章
- \`get_post\` — 获取文章详情（必须是你自己的文章）
- \`create_post\` — 创建新文章（自动归入你的分类）
- \`update_post\` — 更新已有文章（必须是你自己的文章）
- \`delete_post\` — 删除文章（必须是你自己的文章）

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
| **Cross-agent access** | `agentPostEntity` 的 dataLayer 在每个操作中校验 `ai_agent_id`，不匹配则返回 404 |
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
  "admin.aiAgents.keyWarning": "Save this API key now — it won't be shown again!"
}

// src/i18n/locales/zh.json
{
  "admin.nav.aiAgents": "AI 代理",
  "admin.aiAgents.title": "AI 代理作者",
  "admin.aiAgents.create": "创建代理",
  "admin.aiAgents.edit": "编辑代理",
  "admin.aiAgents.regenerateKey": "重新生成 API Key",
  "admin.aiAgents.keyWarning": "请立即保存此 API Key，之后将无法再次查看！"
}
```

---

## Testing Strategy

### L1 — Unit Tests

| File | Tests |
|------|-------|
| `src/data/entities/ai-agent.test.ts` | CRUD, key generation, hash validation, prefix check, soft delete protection |
| `src/lib/ai-agent/avatar.test.ts` | Square validation, size validation, multi-size upload |
| `src/lib/ai-agent/prompt-generator.test.ts` | Template rendering, placeholder substitution |
| `src/lib/mcp/entities/agent-post.test.ts` | ai_agent_id scoping, status forcing, field stripping |

### L2 — Lint + Type Check

```bash
bun run lint
bun run typecheck
```

### L3 — API E2E Tests

| File | Tests |
|------|-------|
| `e2e/api/ai-agents.test.ts` | Create returns key once; regenerate works; avatar validates square; inactive rejected |
| `e2e/api/mcp.test.ts` (extended) | Agent auth accepted; ai_agent_id scoping; status locked; cross-agent denied; extra tools not registered |

### L4 — BDD E2E (Optional)

Full flow: create agent → copy prompt → use key in MCP call → verify post created as private with correct ai_agent_id → verify agent author shown on post page.

---

## Atomic Commits

| # | Commit Message | Files | Verify |
|---|----------------|-------|--------|
| 1 | feat(db): add ai_agents table migration | `scripts/migrations/014-ai-agents.sql` | `bun run migrate:local` |
| 2 | feat(db): add ai_agent_id to posts | `scripts/migrations/015-post-ai-agent.sql` | `bun run migrate:local` |
| 3 | feat(data): add ai-agent entity CRUD | `src/data/entities/ai-agent.ts`, `ai-agent.test.ts` | `bun test ai-agent` |
| 4 | feat(data): add ai_agent_id to post entity | `src/data/entities/post.ts`, `post.test.ts` | `bun test post` |
| 5 | feat(ai-agent): add avatar upload utilities | `src/lib/ai-agent/avatar.ts`, `avatar.test.ts` | `bun test avatar` |
| 6 | feat(ai-agent): add Chinese prompt generator | `src/lib/ai-agent/prompt-generator.ts`, `prompt-generator.test.ts` | `bun test prompt` |
| 7 | feat(ai-agent): add sync author resolution helper | `src/lib/ai-agent/author.ts`, `author.test.ts` | `bun test author` |
| 8 | feat(api): add ai-agents admin CRUD routes | `src/app/api/admin/ai-agents/**` | `bun test` |
| 9 | feat(mcp): add agent token validation to auth | `src/lib/mcp/auth.ts`, `auth.test.ts` | `bun test auth` |
| 10 | feat(mcp): add agentPostEntity for ai_agent_id-scoped access | `src/lib/mcp/entities/agent-post.ts`, `agent-post.test.ts` | `bun test agent-post` |
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
# 1. Create agent in /admin/ai-agents (with category binding)
# 2. Save API key from modal (only shown once)
# 3. Call /api/mcp with agent key → create_post
# 4. Verify: post status = private, ai_agent_id = agent.id
# 5. Verify: agent avatar shown on post detail page
# 6. Verify: agent name in HTML metadata (og:article:author)
# 7. Verify: agent name in RSS feed item
# 8. Verify: agent name in JSON-LD author field
```
