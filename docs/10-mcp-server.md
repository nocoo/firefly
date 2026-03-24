# 10 — MCP Server Design

Firefly MCP (Model Context Protocol) server — allows AI agents to authenticate via OAuth and perform full CRUD operations on blog content (posts, tags, categories).

## Overview

### Problem

AI agents (Claude Code, Claude Desktop, Cursor, etc.) need programmatic access to the blog for daily collaboration: drafting posts, managing tags/categories, publishing content. The current admin UI requires browser-based Google OAuth, which agents cannot use.

### Solution

Expose a **Streamable HTTP** MCP server at `/api/mcp` with **OAuth 2.1** authentication. Agents authenticate once via browser-based OAuth flow, receive a persistent token, and use it for all subsequent MCP tool calls.

### Architecture Position

```
┌─────────────────────────────────────────────────────────────┐
│  AI Agent (Claude Code / Claude Desktop / Cursor)           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  MCP Client                                           │  │
│  │  1. Discovers OAuth metadata                          │  │
│  │  2. Opens browser → user logs in via Google           │  │
│  │  3. Receives token via localhost callback              │  │
│  │  4. Calls tools with Bearer token                     │  │
│  └────────────────────────┬──────────────────────────────┘  │
└───────────────────────────┼─────────────────────────────────┘
                            │ HTTPS + Bearer token
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Firefly (Next.js on Railway)                               │
│                                                              │
│  /.well-known/oauth-authorization-server  → metadata         │
│  /api/mcp/register                        → client reg       │
│  /api/mcp/authorize                       → OAuth consent    │
│  /api/mcp/token                           → token exchange   │
│  /api/mcp/callback                        → redirect target  │
│  /api/mcp                                 → MCP endpoint     │
│  /admin/mcp                               → token management │
│                                                              │
│  ┌────────────┐  ┌──────────┐  ┌────────────────────────┐   │
│  │ OAuth      │  │ MCP      │  │ Existing Data Layer    │   │
│  │ Provider   │──│ Server   │──│ posts/tags/categories  │   │
│  │ (custom)   │  │ (SDK v2) │  │ src/data/*.ts          │   │
│  └────────────┘  └──────────┘  └────────────────────────┘   │
│                                         │                    │
│                                         ▼                    │
│                                  ┌──────────────┐            │
│                                  │ Cloudflare D1│            │
│                                  └──────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. OAuth 2.1 Authentication

### 1.1 Flow Overview

MCP spec mandates OAuth 2.1 with PKCE. Since Firefly is a **single-user blog**, the OAuth flow authenticates the blog owner (admin) via the existing Google OAuth, then issues a **Firefly MCP token** for the agent.

```
Agent                    Firefly                    Google
  │                         │                          │
  ├─ GET /.well-known/      │                          │
  │  oauth-authorization-   │                          │
  │  server                 │                          │
  │◄── metadata document ───┤                          │
  │                         │                          │
  ├─ POST /api/mcp/register │                          │
  │◄── client_id ───────────┤                          │
  │                         │                          │
  │ [Generate PKCE pair]    │                          │
  │                         │                          │
  ├─ Open browser ──────────┼─────────────────────────►│
  │  /api/mcp/authorize     │  redirect to Google      │
  │                         │  OAuth                   │
  │                         │◄── Google callback ──────┤
  │                         │  (verify email whitelist)│
  │                         │                          │
  │                         │  Generate auth code      │
  │◄── redirect to ─────────┤                          │
  │    localhost callback   │                          │
  │    with ?code=xxx       │                          │
  │                         │                          │
  ├─ POST /api/mcp/token    │                          │
  │  (code + code_verifier) │                          │
  │◄── access_token ────────┤                          │
  │    refresh_token        │                          │
  │                         │                          │
  ├─ POST /api/mcp          │                          │
  │  Authorization: Bearer  │                          │
  │  [MCP tool calls]       │                          │
  │◄── tool results ────────┤                          │
```

### 1.2 Database Schema — New Tables

#### `mcp_clients` — Dynamic Client Registration (RFC 7591)

```sql
CREATE TABLE mcp_clients (
  id              TEXT PRIMARY KEY,  -- ULID
  client_id       TEXT NOT NULL UNIQUE,
  client_secret   TEXT,                             -- nullable for public clients
  client_name     TEXT NOT NULL,
  redirect_uris   TEXT NOT NULL,                    -- JSON array
  grant_types     TEXT NOT NULL DEFAULT '["authorization_code"]',  -- JSON array
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX idx_mcp_clients_client_id ON mcp_clients(client_id);
```

#### `mcp_auth_codes` — Temporary Authorization Codes

```sql
CREATE TABLE mcp_auth_codes (
  code            TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL,
  redirect_uri    TEXT NOT NULL,
  code_challenge  TEXT NOT NULL,                    -- PKCE S256
  user_email      TEXT NOT NULL,
  scope           TEXT NOT NULL DEFAULT 'mcp:full',
  expires_at      INTEGER NOT NULL,                 -- unix epoch, 10 min TTL
  used            INTEGER NOT NULL DEFAULT 0,       -- 0=unused, 1=consumed
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_mcp_auth_codes_expires ON mcp_auth_codes(expires_at);
```

#### `mcp_tokens` — Persistent Access & Refresh Tokens

```sql
CREATE TABLE mcp_tokens (
  id              TEXT PRIMARY KEY,  -- ULID
  access_token    TEXT NOT NULL UNIQUE,
  refresh_token   TEXT UNIQUE,
  client_id       TEXT NOT NULL,
  user_email      TEXT NOT NULL,
  scope           TEXT NOT NULL DEFAULT 'mcp:full',
  client_name     TEXT,                             -- denormalized for admin display
  last_used_at    INTEGER,
  expires_at      INTEGER NOT NULL,                 -- access token TTL: 30 days
  refresh_expires_at INTEGER,                       -- refresh token TTL: 90 days
  revoked         INTEGER NOT NULL DEFAULT 0,       -- 0=active, 1=revoked
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX idx_mcp_tokens_access ON mcp_tokens(access_token);
CREATE UNIQUE INDEX idx_mcp_tokens_refresh ON mcp_tokens(refresh_token);
CREATE INDEX idx_mcp_tokens_user ON mcp_tokens(user_email);
```

### 1.3 OAuth Endpoints

#### `GET /.well-known/oauth-authorization-server`

File: `src/app/.well-known/oauth-authorization-server/route.ts`

Returns OAuth metadata per RFC 8414:

```json
{
  "issuer": "https://lizheng.me",
  "authorization_endpoint": "https://lizheng.me/api/mcp/authorize",
  "token_endpoint": "https://lizheng.me/api/mcp/token",
  "registration_endpoint": "https://lizheng.me/api/mcp/register",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"],
  "scopes_supported": ["mcp:full"],
  "service_documentation": "https://lizheng.me/docs/mcp"
}
```

#### `POST /api/mcp/register`

File: `src/app/api/mcp/register/route.ts`

Dynamic Client Registration (RFC 7591). Any MCP client can register itself.

Request:
```json
{
  "client_name": "Claude Code",
  "redirect_uris": ["http://localhost:8080/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

Response:
```json
{
  "client_id": "firefly_mcp_01JQ...",
  "client_name": "Claude Code",
  "redirect_uris": ["http://localhost:8080/callback"],
  "grant_types": ["authorization_code"],
  "token_endpoint_auth_method": "none"
}
```

Validation:
- `client_name` required, max 255 chars
- `redirect_uris` required, at least 1, each must be valid URL
- Store in `mcp_clients` table

#### `GET /api/mcp/authorize`

File: `src/app/api/mcp/authorize/route.ts`

OAuth authorization endpoint. Agent opens this URL in the user's browser.

Query params:
| Param | Required | Description |
|-------|----------|-------------|
| `response_type` | yes | Must be `code` |
| `client_id` | yes | From registration |
| `redirect_uri` | yes | Must match registered URI |
| `code_challenge` | yes | PKCE S256 challenge |
| `code_challenge_method` | yes | Must be `S256` |
| `state` | yes | CSRF protection |
| `scope` | no | Default `mcp:full` |

Flow:
1. Validate `client_id` exists in `mcp_clients`
2. Validate `redirect_uri` matches registered URIs
3. Store params in encrypted session cookie
4. Redirect to Google OAuth (`/api/auth/signin/google`) with a custom `callbackUrl` pointing back to `/api/mcp/callback`

#### `GET /api/mcp/callback`

File: `src/app/api/mcp/callback/route.ts`

Internal callback — Google OAuth redirects here after login success.

Flow:
1. Verify user session via `auth()` (Auth.js)
2. Verify email is in whitelist via `isEmailAllowed()`
3. Read OAuth params from session cookie
4. Generate random `authorization_code` (64-char hex)
5. Store in `mcp_auth_codes` with 10-min TTL
6. Redirect to agent's `redirect_uri` with `?code=xxx&state=yyy`

#### `POST /api/mcp/token`

File: `src/app/api/mcp/token/route.ts`

Token exchange endpoint. Supports two grant types:

**Authorization Code Exchange:**

Request (`application/x-www-form-urlencoded`):
| Field | Required | Description |
|-------|----------|-------------|
| `grant_type` | yes | `authorization_code` |
| `code` | yes | Authorization code |
| `redirect_uri` | yes | Must match authorize request |
| `client_id` | yes | Registered client ID |
| `code_verifier` | yes | PKCE verifier (plaintext) |

Response:
```json
{
  "access_token": "firefly_at_...",
  "token_type": "Bearer",
  "expires_in": 2592000,
  "refresh_token": "firefly_rt_...",
  "scope": "mcp:full"
}
```

Validation:
1. Look up `code` in `mcp_auth_codes`
2. Verify not expired (`expires_at > now`)
3. Verify not already used (`used = 0`), then mark `used = 1`
4. Verify `client_id` matches
5. Verify `redirect_uri` matches
6. Verify PKCE: `SHA256(code_verifier)` equals stored `code_challenge`
7. Generate `access_token` (prefix `firefly_at_`, 48-char random hex)
8. Generate `refresh_token` (prefix `firefly_rt_`, 48-char random hex)
9. Store in `mcp_tokens`, access TTL 30 days, refresh TTL 90 days

**Refresh Token Exchange:**

Request:
| Field | Required | Description |
|-------|----------|-------------|
| `grant_type` | yes | `refresh_token` |
| `refresh_token` | yes | Current refresh token |
| `client_id` | yes | Registered client ID |

Response: same as above (new token pair, old tokens revoked).

Token rotation: each refresh invalidates the previous pair and issues a new pair.

### 1.4 Token Lifecycle

| Token Type | TTL | Prefix | Rotation |
|------------|-----|--------|----------|
| Authorization Code | 10 min | (raw hex) | Single-use |
| Access Token | 30 days | `firefly_at_` | Rotated on refresh |
| Refresh Token | 90 days | `firefly_rt_` | Rotated on refresh |

The long TTL for access tokens (30 days) is intentional for a single-user blog — agents shouldn't need to re-authenticate frequently.

---

## 2. MCP Server Endpoint

### 2.1 Transport

**Streamable HTTP** (MCP spec 2025-03-26) at `POST /api/mcp` and `GET /api/mcp`.

File: `src/app/api/mcp/route.ts`

- `POST` — receives JSON-RPC messages, returns `application/json` or `text/event-stream`
- `GET` — SSE stream for server-initiated notifications (optional, phase 2)
- `DELETE` — session termination

Authentication: every request must include `Authorization: Bearer <access_token>`. Validate against `mcp_tokens` table (not revoked, not expired). Update `last_used_at` on each valid call.

### 2.2 Server Identity

```typescript
const server = new McpServer({
  name: "firefly",
  version: "0.2.0",  // sync with package.json
});
```

### 2.3 Session Management

Stateful mode with `Mcp-Session-Id` header. Session maps to a single authenticated user.

---

## 3. MCP Tools

### 3.1 Posts

#### `list_posts`

List blog posts with optional filters.

```typescript
{
  name: "list_posts",
  description: "List blog posts. Returns paginated results with category info. Defaults to published posts, but can filter by any status.",
  inputSchema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["draft", "published", "private", "archived"],
        description: "Filter by post status. Omit to list all statuses."
      },
      category_id: {
        type: "string",
        description: "Filter by category ID (ULID)"
      },
      tag_id: {
        type: "string",
        description: "Filter by tag ID (ULID)"
      },
      query: {
        type: "string",
        description: "Full-text search in title and content"
      },
      page: {
        type: "number",
        description: "Page number (1-based). Default: 1"
      },
      page_size: {
        type: "number",
        description: "Results per page (1-100). Default: 20"
      }
    }
  },
  annotations: {
    title: "List Posts",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false
  }
}
```

Returns: `{ posts: PostWithCategory[], total: number }`

Data layer: `listPosts()` from `src/data/posts.ts`. Unlike the public API (`GET /api/posts`) which is hardcoded to `status = "published"`, the MCP tool passes through the authenticated user's `status` filter — agents can see drafts.

#### `get_post`

Get a single post by slug, including tags.

```typescript
{
  name: "get_post",
  description: "Get a single post by slug. Returns full post content with tags and category. Can access any status (draft, published, private, archived).",
  inputSchema: {
    type: "object",
    properties: {
      slug: {
        type: "string",
        description: "Post slug (URL identifier)"
      }
    },
    required: ["slug"]
  },
  annotations: {
    title: "Get Post",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false
  }
}
```

Returns: `PostWithTags` (includes `tags: { id, name, slug }[]`)

Data layer: `getPostBySlug()` from `src/data/posts.ts` — no status filter (authenticated access).

#### `create_post`

Create a new blog post.

```typescript
{
  name: "create_post",
  description: "Create a new blog post. Title and slug are required. Content is markdown. Status defaults to 'draft'. Optionally assign category and tags.",
  inputSchema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Post title"
      },
      slug: {
        type: "string",
        description: "URL slug (must be unique, lowercase, hyphens only)"
      },
      content: {
        type: "string",
        description: "Post content in Markdown format"
      },
      status: {
        type: "string",
        enum: ["draft", "published", "private", "archived"],
        description: "Post status. Default: 'draft'"
      },
      excerpt: {
        type: "string",
        description: "Manual excerpt. If omitted, auto-generated from content"
      },
      category_id: {
        type: "string",
        description: "Category ID (ULID). Use list_categories to find available IDs"
      },
      tag_ids: {
        type: "array",
        items: { type: "string" },
        description: "Array of tag IDs (ULID). Use list_tags to find available IDs"
      },
      featured_image: {
        type: "string",
        description: "Featured image URL or R2 key"
      },
      published_at: {
        type: "number",
        description: "Unix epoch timestamp. Auto-set to now when status is 'published' if omitted"
      }
    },
    required: ["title", "slug", "content"]
  },
  annotations: {
    title: "Create Post",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  }
}
```

Returns: created `Post` object.

Data layer: `createPost()` + `setPostTags()` from `src/data/posts.ts`.

#### `update_post`

Update an existing post by slug.

```typescript
{
  name: "update_post",
  description: "Update an existing post by slug. Only provided fields are updated — omitted fields remain unchanged. Use this to edit content, change status, reassign category/tags.",
  inputSchema: {
    type: "object",
    properties: {
      slug: {
        type: "string",
        description: "Current slug of the post to update"
      },
      title: {
        type: "string",
        description: "New title"
      },
      new_slug: {
        type: "string",
        description: "New slug (for renaming URL)"
      },
      content: {
        type: "string",
        description: "New content in Markdown format"
      },
      status: {
        type: "string",
        enum: ["draft", "published", "private", "archived"],
        description: "New status"
      },
      excerpt: {
        type: "string",
        description: "New excerpt. Pass null to clear and auto-regenerate"
      },
      category_id: {
        type: ["string", "null"],
        description: "New category ID. Pass null to remove category"
      },
      tag_ids: {
        type: "array",
        items: { type: "string" },
        description: "Replace all tags with this list. Pass empty array to remove all tags"
      },
      featured_image: {
        type: ["string", "null"],
        description: "New featured image URL. Pass null to remove"
      },
      published_at: {
        type: ["number", "null"],
        description: "New publish timestamp. Pass null to clear"
      }
    },
    required: ["slug"]
  },
  annotations: {
    title: "Update Post",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
}
```

Returns: updated `Post` object.

Data layer: `getPostBySlug()` → `updatePost()` + `setPostTags()` from `src/data/posts.ts`.

#### `delete_post`

Delete a post by slug.

```typescript
{
  name: "delete_post",
  description: "Permanently delete a post by slug. This also removes all associated tag relationships. This action is irreversible.",
  inputSchema: {
    type: "object",
    properties: {
      slug: {
        type: "string",
        description: "Slug of the post to delete"
      }
    },
    required: ["slug"]
  },
  annotations: {
    title: "Delete Post",
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false
  }
}
```

Returns: `{ deleted: true }`

Data layer: `getPostBySlug()` → `deletePost()` from `src/data/posts.ts`.

#### `generate_excerpt`

Generate AI excerpt for a post.

```typescript
{
  name: "generate_excerpt",
  description: "Generate an AI-powered excerpt for an existing post. Uses the configured AI provider (Anthropic, MiniMax, GLM, etc.). Saves the excerpt to the post automatically.",
  inputSchema: {
    type: "object",
    properties: {
      slug: {
        type: "string",
        description: "Slug of the post to generate excerpt for"
      }
    },
    required: ["slug"]
  },
  annotations: {
    title: "Generate Excerpt",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
}
```

Returns: `{ excerpt: string }` — the generated excerpt text.

Data layer: Reuse logic from `src/app/api/posts/[slug]/excerpt/route.ts` → `src/services/ai.ts`.

### 3.2 Tags

#### `list_tags`

List all tags.

```typescript
{
  name: "list_tags",
  description: "List all tags, ordered by name. Returns tag name, slug, and post count.",
  inputSchema: {
    type: "object",
    properties: {}
  },
  annotations: {
    title: "List Tags",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false
  }
}
```

Returns: `Tag[]`

Data layer: `listTags()` from `src/data/tags.ts`.

#### `get_tag`

Get a single tag by slug.

```typescript
{
  name: "get_tag",
  description: "Get a single tag by slug. Returns tag details including post count.",
  inputSchema: {
    type: "object",
    properties: {
      slug: {
        type: "string",
        description: "Tag slug"
      }
    },
    required: ["slug"]
  },
  annotations: {
    title: "Get Tag",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false
  }
}
```

Returns: `Tag`

Data layer: `getTagBySlug()` from `src/data/tags.ts`.

#### `create_tag`

Create a new tag.

```typescript
{
  name: "create_tag",
  description: "Create a new tag. Both name and slug are required. Slug must be unique.",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Display name (e.g. 'Machine Learning')"
      },
      slug: {
        type: "string",
        description: "URL slug (e.g. 'machine-learning', must be unique, lowercase)"
      }
    },
    required: ["name", "slug"]
  },
  annotations: {
    title: "Create Tag",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  }
}
```

Returns: created `Tag` object.

Data layer: `createTag()` from `src/data/tags.ts`.

#### `update_tag`

Update an existing tag.

```typescript
{
  name: "update_tag",
  description: "Update an existing tag by slug. Can change name and/or slug.",
  inputSchema: {
    type: "object",
    properties: {
      slug: {
        type: "string",
        description: "Current slug of the tag to update"
      },
      name: {
        type: "string",
        description: "New display name"
      },
      new_slug: {
        type: "string",
        description: "New slug"
      }
    },
    required: ["slug"]
  },
  annotations: {
    title: "Update Tag",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
}
```

Returns: updated `Tag` object.

Data layer: `getTagBySlug()` → `updateTag()` from `src/data/tags.ts`.

#### `delete_tag`

Delete a tag.

```typescript
{
  name: "delete_tag",
  description: "Delete a tag by slug. Removes the tag and all post-tag associations. Posts themselves are not affected.",
  inputSchema: {
    type: "object",
    properties: {
      slug: {
        type: "string",
        description: "Slug of the tag to delete"
      }
    },
    required: ["slug"]
  },
  annotations: {
    title: "Delete Tag",
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false
  }
}
```

Returns: `{ deleted: true }`

Data layer: `getTagBySlug()` → `deleteTag()` from `src/data/tags.ts`.

### 3.3 Categories

#### `list_categories`

List all categories.

```typescript
{
  name: "list_categories",
  description: "List all categories, ordered by sort_order then name. Returns name, slug, description, and post count.",
  inputSchema: {
    type: "object",
    properties: {}
  },
  annotations: {
    title: "List Categories",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false
  }
}
```

Returns: `Category[]`

Data layer: `listCategories()` from `src/data/categories.ts`.

#### `get_category`

Get a single category by slug.

```typescript
{
  name: "get_category",
  description: "Get a single category by slug. Returns category details including post count and description.",
  inputSchema: {
    type: "object",
    properties: {
      slug: {
        type: "string",
        description: "Category slug"
      }
    },
    required: ["slug"]
  },
  annotations: {
    title: "Get Category",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false
  }
}
```

Returns: `Category`

Data layer: `getCategoryBySlug()` from `src/data/categories.ts`.

#### `create_category`

Create a new category.

```typescript
{
  name: "create_category",
  description: "Create a new category. Name and slug are required.",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Display name (e.g. '随笔')"
      },
      slug: {
        type: "string",
        description: "URL slug (e.g. 'essays', must be unique, lowercase)"
      },
      description: {
        type: "string",
        description: "Category description"
      },
      sort_order: {
        type: "number",
        description: "Sort order (lower = first). Default: 0"
      }
    },
    required: ["name", "slug"]
  },
  annotations: {
    title: "Create Category",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  }
}
```

Returns: created `Category` object.

Data layer: `createCategory()` from `src/data/categories.ts`.

#### `update_category`

Update an existing category.

```typescript
{
  name: "update_category",
  description: "Update an existing category by slug. Can change name, slug, description, and sort order.",
  inputSchema: {
    type: "object",
    properties: {
      slug: {
        type: "string",
        description: "Current slug of the category to update"
      },
      name: {
        type: "string",
        description: "New display name"
      },
      new_slug: {
        type: "string",
        description: "New slug"
      },
      description: {
        type: ["string", "null"],
        description: "New description. Pass null to remove"
      },
      sort_order: {
        type: "number",
        description: "New sort order"
      }
    },
    required: ["slug"]
  },
  annotations: {
    title: "Update Category",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
}
```

Returns: updated `Category` object.

Data layer: `getCategoryBySlug()` → `updateCategory()` from `src/data/categories.ts`.

#### `delete_category`

Delete a category.

```typescript
{
  name: "delete_category",
  description: "Delete a category by slug. Posts in this category will have their category_id set to NULL.",
  inputSchema: {
    type: "object",
    properties: {
      slug: {
        type: "string",
        description: "Slug of the category to delete"
      }
    },
    required: ["slug"]
  },
  annotations: {
    title: "Delete Category",
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false
  }
}
```

Returns: `{ deleted: true }`

Data layer: `getCategoryBySlug()` → `deleteCategory()` from `src/data/categories.ts`.

### 3.4 Tool Summary

| Tool | Entity | Operation | Destructive |
|------|--------|-----------|-------------|
| `list_posts` | Post | Read | No |
| `get_post` | Post | Read | No |
| `create_post` | Post | Create | No |
| `update_post` | Post | Update | No |
| `delete_post` | Post | Delete | **Yes** |
| `generate_excerpt` | Post | Update (AI) | No |
| `list_tags` | Tag | Read | No |
| `get_tag` | Tag | Read | No |
| `create_tag` | Tag | Create | No |
| `update_tag` | Tag | Update | No |
| `delete_tag` | Tag | Delete | **Yes** |
| `list_categories` | Category | Read | No |
| `get_category` | Category | Read | No |
| `create_category` | Category | Create | No |
| `update_category` | Category | Update | No |
| `delete_category` | Category | Delete | **Yes** |

**16 tools total** — 6 read, 7 write, 3 delete.

---

## 4. Admin MCP Token Management Page

### 4.1 Page Location

File: `src/app/admin/mcp/page.tsx`
Route: `/admin/mcp`
Sidebar: listed under "System" group as "MCP Tokens" with `Key` icon

### 4.2 UI Design

The page displays all issued MCP tokens with management controls:

```
┌──────────────────────────────────────────────────────────────┐
│  MCP Tokens                                                  │
│                                                              │
│  Manage tokens for AI agent access via MCP protocol.         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ● Active    Claude Code                               │  │
│  │  Token:      firefly_at_a1b2...****                    │  │
│  │  Created:    2026-03-20                                │  │
│  │  Last used:  2 hours ago                               │  │
│  │  Expires:    2026-04-19                                │  │
│  │                                          [Revoke]      │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │  ○ Revoked   Cursor                                    │  │
│  │  Token:      firefly_at_c3d4...****                    │  │
│  │  Created:    2026-03-15                                │  │
│  │  Revoked:    2026-03-18                                │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  MCP Server Endpoint                                         │
│  https://lizheng.me/api/mcp                                 │
│                                                              │
│  Add this to your agent's MCP configuration:                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  {                                                     │  │
│  │    "mcpServers": {                                     │  │
│  │      "firefly": {                                      │  │
│  │        "url": "https://lizheng.me/api/mcp"            │  │
│  │      }                                                 │  │
│  │    }                                                   │  │
│  │  }                                                     │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Admin API Endpoints

#### `GET /api/mcp/tokens`

File: `src/app/api/mcp/tokens/route.ts`

Returns all tokens for the admin display (requires Auth.js session).

Response:
```json
{
  "tokens": [
    {
      "id": "01JQ...",
      "client_name": "Claude Code",
      "access_token_preview": "firefly_at_a1b2...****",
      "scope": "mcp:full",
      "last_used_at": 1711234567,
      "expires_at": 1713826567,
      "revoked": false,
      "created_at": 1711234567
    }
  ]
}
```

#### `DELETE /api/mcp/tokens/[id]`

File: `src/app/api/mcp/tokens/[id]/route.ts`

Revoke a token. Sets `revoked = 1` on both access and refresh tokens.

---

## 5. File Structure

New files to create:

```
src/
├── app/
│   ├── .well-known/
│   │   └── oauth-authorization-server/
│   │       └── route.ts                    # OAuth metadata
│   ├── api/
│   │   └── mcp/
│   │       ├── route.ts                    # MCP Streamable HTTP endpoint
│   │       ├── register/
│   │       │   └── route.ts                # Dynamic client registration
│   │       ├── authorize/
│   │       │   └── route.ts                # OAuth authorization
│   │       ├── callback/
│   │       │   └── route.ts                # Google OAuth callback
│   │       ├── token/
│   │       │   └── route.ts                # Token exchange
│   │       └── tokens/
│   │           ├── route.ts                # List tokens (admin)
│   │           └── [id]/
│   │               └── route.ts            # Revoke token (admin)
│   └── admin/
│       └── mcp/
│           └── page.tsx                    # Token management page
├── components/
│   └── admin/
│       └── mcp-tokens.tsx                  # Token list component
├── data/
│   ├── mcp-clients.ts                      # mcp_clients CRUD
│   ├── mcp-auth-codes.ts                   # mcp_auth_codes CRUD
│   └── mcp-tokens.ts                       # mcp_tokens CRUD
├── lib/
│   └── mcp/
│       ├── server.ts                       # McpServer instance + tool registration
│       ├── auth.ts                         # Token validation middleware
│       └── tools/
│           ├── posts.ts                    # Post tools (6)
│           ├── tags.ts                     # Tag tools (5)
│           └── categories.ts              # Category tools (5)
└── models/
    └── types.ts                            # Add McpClient, McpAuthCode, McpToken types
```

Files to modify:

```
src/proxy.ts                                # Exempt /api/mcp/* from Auth.js guard
src/components/admin/sidebar.tsx            # Add "MCP Tokens" nav item
supabase/ or migrations/                    # New D1 migration for mcp_* tables
docs/README.md                              # Add this doc to index
```

---

## 6. Middleware Auth Exemption

`src/proxy.ts` currently guards all `POST/PUT/DELETE/PATCH` on `/api/*` with Auth.js session. The MCP endpoints use their own OAuth flow, so they must be exempted:

```typescript
// In isProtectedApiRoute():
function isProtectedApiRoute(pathname: string, method: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/api/auth/")) return false;
  if (pathname.startsWith("/api/mcp/")) return false;   // ← new: MCP has its own auth
  return PROTECTED_API_METHODS.includes(method);
}
```

The MCP endpoint (`/api/mcp`) handles its own Bearer token validation internally. The OAuth endpoints (`/api/mcp/register`, `/api/mcp/authorize`, `/api/mcp/token`) are public by design per the OAuth spec. The admin endpoints (`/api/mcp/tokens`) will check Auth.js session internally.

---

## 7. Dependencies

```json
{
  "@modelcontextprotocol/server": "^2.0.0",
  "zod": "^3.24.0"
}
```

Note: `zod` is already used by Auth.js indirectly, but should be added as a direct dependency for MCP tool schema definitions.

The MCP SDK v2 uses Zod for schema definition. Since Firefly runs on Next.js (Node.js runtime on Railway), the `@modelcontextprotocol/server` package provides the `McpServer` class. We handle the HTTP transport ourselves within Next.js API routes rather than using `@modelcontextprotocol/express`, since Next.js App Router has its own request/response handling.

---

## 8. Security Considerations

1. **Single-user enforcement** — `isEmailAllowed()` whitelist (existing) gates OAuth authorization. Only `AUTH_ALLOWED_EMAILS` users can complete the flow.

2. **PKCE mandatory** — All authorization code grants require S256 code challenge. No plain method.

3. **Token prefix** — `firefly_at_` / `firefly_rt_` prefixes enable easy scanning for leaked tokens in logs/commits.

4. **Token rotation** — Refresh always invalidates the previous pair, preventing token reuse after refresh.

5. **Origin validation** — MCP endpoint validates `Origin` header per spec to prevent DNS rebinding attacks.

6. **Rate limiting** — Token endpoint should rate-limit by client IP (5 req/min) to prevent brute-force.

7. **Auth code single-use** — Authorization codes are marked `used = 1` immediately on consumption, preventing replay.

8. **Admin token page** — Protected by existing Auth.js session (Google OAuth), not by MCP tokens.

---

## 9. Atomic Commits Plan

| # | Commit | Files |
|---|--------|-------|
| 1 | `feat: add mcp database tables migration` | D1 migration file |
| 2 | `feat: add mcp type definitions` | `src/models/types.ts` |
| 3 | `feat: add mcp data layer (clients, auth codes, tokens)` | `src/data/mcp-*.ts` |
| 4 | `feat: add oauth metadata endpoint` | `.well-known/oauth-authorization-server/route.ts` |
| 5 | `feat: add mcp client registration endpoint` | `src/app/api/mcp/register/route.ts` |
| 6 | `feat: add mcp oauth authorize and callback` | `src/app/api/mcp/authorize/route.ts`, `callback/route.ts` |
| 7 | `feat: add mcp token exchange endpoint` | `src/app/api/mcp/token/route.ts` |
| 8 | `feat: add mcp token validation middleware` | `src/lib/mcp/auth.ts` |
| 9 | `feat: add mcp post tools` | `src/lib/mcp/tools/posts.ts` |
| 10 | `feat: add mcp tag tools` | `src/lib/mcp/tools/tags.ts` |
| 11 | `feat: add mcp category tools` | `src/lib/mcp/tools/categories.ts` |
| 12 | `feat: add mcp server and streamable http endpoint` | `src/lib/mcp/server.ts`, `src/app/api/mcp/route.ts` |
| 13 | `feat: exempt mcp routes from auth.js middleware` | `src/proxy.ts` |
| 14 | `feat: add admin mcp token management page` | `src/app/admin/mcp/page.tsx`, components |
| 15 | `feat: add admin mcp token api endpoints` | `src/app/api/mcp/tokens/route.ts` |
| 16 | `docs: add mcp server design document` | `docs/10-mcp-server.md`, `docs/README.md` |

---

## 10. Testing Strategy

### Unit Tests (Vitest)

| Layer | Coverage Target | Key Tests |
|-------|----------------|-----------|
| Data (`mcp-*.ts`) | Token CRUD, expiry check, revocation logic | Token validation with expired/revoked/valid states |
| Auth (`lib/mcp/auth.ts`) | Bearer extraction, token lookup, `last_used_at` update | Missing header, invalid token, expired token |
| Tools (`lib/mcp/tools/*.ts`) | Input validation, data layer delegation | Each tool with valid/invalid inputs |
| OAuth endpoints | Registration validation, PKCE verification, code exchange | Invalid client_id, expired code, wrong verifier |

### API E2E Tests (Playwright)

| Flow | Description |
|------|-------------|
| Registration | `POST /api/mcp/register` → valid client_id returned |
| Token exchange | Full code → token flow (mocked Google OAuth) |
| Tool invocation | Authenticated MCP POST with `tools/list` and `tools/call` |
| Token revocation | Admin revokes token → subsequent MCP calls return 401 |
| Metadata discovery | `GET /.well-known/oauth-authorization-server` returns valid metadata |
