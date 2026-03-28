# 16 — Entity-Driven MCP Framework

Refactor the 17 hand-written MCP tool handlers into a declarative, entity-driven framework. Each entity (tag, category, post) is defined as a configuration object; the framework generates all CRUD handlers, registers tools, and enforces a uniform protocol. Entity-specific logic (relations, AI extras) is expressed through lifecycle hooks.

## Motivation

### Current State

Three sets of nearly identical CRUD handlers (`tags.ts` 117 LOC, `categories.ts` 129 LOC, `posts.ts` 389 LOC) with:
- Same `getBySlug → not-found check → data layer call → JSON serialize` pattern copy-pasted 15 times
- Same response format (`{ content: [{ type: "text", text }] }`) duplicated in every return
- Same error format (`{ ..., isError: true }`) duplicated in every error path
- `ToolContext` defined identically in 3 files
- `createMockDb()` duplicated in 3 test files
- No ID-based lookup, no context-efficient projections, no uniform validation

### Target State

```ts
// This is all you write to get 5 CRUD tools + ID/slug resolution + field projection:
const tagEntity = defineEntity("tag", {
  display: "tag",
  dataLayer: { list: listTags, getById: getTagById, getBySlug: getTagBySlug, create: createTag, update: updateTag, delete: deleteTag },
  schemas: {
    create: { name: z.string(), slug: z.string() },
    update: { name: z.string().optional(), new_slug: z.string().optional() },
    list: {},
  },
});
```

Posts add hooks and extra tools on top of the same base:
```ts
const postEntity = defineEntity("post", {
  ...baseConfig,
  hooks: {
    afterGet: async (ctx, post) => ({ ...post, tags: await getPostTags(ctx.db, post.id) }),
    afterCreate: async (ctx, post, args) => { /* set tags */ },
    beforeUpdate: async (ctx, existing, args) => { /* save old tags for rollback */ },
    onUpdateRollback: async (ctx, existing, rollbackData) => { /* restore old tags */ },
  },
  projection: { omit: ["content", "content_html", ...], groups: { content: [...], ... } },
  extraTools: [generateExcerptTool, unfurlReferenceTool],
});
```

---

## Architecture

### Layer Diagram

```
┌───────────────────────────────────────────────────────┐
│  server.ts — registerEntityTools(server, entity, ctx) │
│  Iterates entity config, calls server.tool() 5× + N  │
└──────────────────────┬────────────────────────────────┘
                       │ delegates to
┌──────────────────────▼────────────────────────────────┐
│  framework/handlers.ts — Generic CRUD handler factory │
│  handleList, handleGet, handleCreate, handleUpdate,   │
│  handleDelete — parameterized by EntityConfig         │
└──────────────────────┬────────────────────────────────┘
                       │ uses
┌──────────────────────▼────────────────────────────────┐
│  framework/resolve.ts — ID/slug resolution + validate │
│  framework/response.ts — ok(), error() helpers        │
│  framework/projection.ts — field projection engine    │
│  framework/types.ts — EntityConfig, DataLayer, Hooks  │
└───────────────────────────────────────────────────────┘
                       │ calls
┌──────────────────────▼────────────────────────────────┐
│  Existing data layer (unchanged)                      │
│  src/data/posts.ts, tags.ts, categories.ts            │
└───────────────────────────────────────────────────────┘
```

### File Structure

```
src/lib/mcp/
├── framework/                    # NEW — the reusable framework core
│   ├── types.ts                  # EntityConfig, DataLayer, Hooks, ToolContext
│   ├── resolve.ts                # validateIdOrSlug(), resolveEntity()
│   ├── response.ts               # ok(data), error(msg) — MCP response builders
│   ├── projection.ts             # projectFields(record, omitGroups, include)
│   ├── handlers.ts               # createCrudHandlers(config) → { list, get, create, update, delete }
│   ├── register.ts               # registerEntityTools(server, config, ctx)
│   ├── resolve.test.ts           # Unit tests for resolve
│   ├── response.test.ts          # Unit tests for response builders
│   ├── projection.test.ts        # Unit tests for projection
│   └── handlers.test.ts          # Unit tests for generic handlers with mock config
├── entities/                     # NEW — entity definitions (replaces tools/)
│   ├── tag.ts                    # defineEntity config for tags
│   ├── tag.test.ts               # Tag-specific handler tests
│   ├── category.ts               # defineEntity config for categories
│   ├── category.test.ts          # Category-specific handler tests
│   ├── post.ts                   # defineEntity config for posts + hooks + extras
│   └── post.test.ts              # Post-specific handler tests (hooks, projection, extras)
├── server.ts                     # REFACTORED — uses registerEntityTools
├── server.test.ts                # UPDATED — tool count, schema assertions
├── auth.ts                       # UNCHANGED
├── auth.test.ts                  # UNCHANGED
├── oauth.ts                      # UNCHANGED
└── oauth.test.ts                 # UNCHANGED
```

Old `tools/` directory is deleted after migration. Auth layer is untouched.

---

## Framework Core Design

### `framework/types.ts` — The Entity Contract

```ts
import type { z } from "zod";
import type { Db } from "@/lib/db";

// ---- Context ----

export interface ToolContext {
  db: Db;
}

// ---- Data layer contract ----

export interface DataLayer<T, TCreate = Record<string, unknown>, TUpdate = Record<string, unknown>> {
  list: ((db: Db, opts?: unknown) => Promise<T[] | { items: T[]; total: number }>);
  getById: (db: Db, id: string) => Promise<T | null>;
  getBySlug: (db: Db, slug: string) => Promise<T | null>;
  create: (db: Db, input: TCreate) => Promise<T>;
  update: (db: Db, id: string, input: TUpdate) => Promise<T | null>;
  delete: (db: Db, id: string) => Promise<boolean>;
}

// ---- Lifecycle hooks ----

export interface EntityHooks<T> {
  /** Transform entity after get (e.g., enrich with relations) */
  afterGet?: (ctx: ToolContext, entity: T) => Promise<unknown>;
  /** Run after create (e.g., set relations). Throw to trigger rollback via onCreateRollback. */
  afterCreate?: (ctx: ToolContext, entity: T, args: Record<string, unknown>) => Promise<void>;
  /** Rollback create if afterCreate fails (e.g., delete orphan). */
  onCreateRollback?: (ctx: ToolContext, entity: T) => Promise<void>;
  /** Run before update (e.g., save old state for compensating write). Returns rollback data. */
  beforeUpdate?: (ctx: ToolContext, existing: T, args: Record<string, unknown>) => Promise<unknown>;
  /** Run after update fails to restore pre-update state. */
  onUpdateRollback?: (ctx: ToolContext, existing: T, rollbackData: unknown) => Promise<void>;
  /** Transform create args before passing to data layer (e.g., map tag_ids → separate field). */
  mapCreateInput?: (args: Record<string, unknown>) => Record<string, unknown>;
  /** Transform update args before passing to data layer (e.g., new_slug → slug). */
  mapUpdateInput?: (args: Record<string, unknown>) => Record<string, unknown>;
}

// ---- Field projection ----

export interface ProjectionConfig {
  /** Fields to omit from list responses by default. */
  omit: string[];
  /** Named groups of omitted fields. Key = group name, value = field names. */
  groups: Record<string, string[]>;
}

// ---- Extra tools (non-CRUD) ----

export interface ExtraToolDef {
  name: string;
  description: string;
  schema: Record<string, z.ZodType>;
  handler: (ctx: ToolContext, args: Record<string, unknown>) => Promise<unknown>;
}

// ---- The main entity definition ----

export interface EntityConfig<T = unknown> {
  /** Singular entity name for tool naming: "tag" → list_tags, get_tag, etc. */
  name: string;
  /** Display name for error messages: "Tag not found: ..." */
  display: string;
  /** Plural form for list tool naming. Default: name + "s". */
  plural?: string;
  /** Data layer implementation. */
  dataLayer: DataLayer<T>;
  /** Zod schemas for tool input validation. */
  schemas: {
    list?: Record<string, z.ZodType>;
    create: Record<string, z.ZodType>;
    update: Record<string, z.ZodType>;
  };
  /** Tool descriptions (optional overrides, sensible defaults generated). */
  descriptions?: {
    list?: string;
    get?: string;
    create?: string;
    update?: string;
    delete?: string;
  };
  /** Lifecycle hooks for entity-specific logic. */
  hooks?: EntityHooks<T>;
  /** Field projection config for context-efficient list responses. */
  projection?: ProjectionConfig;
  /** Additional non-CRUD tools. */
  extraTools?: ExtraToolDef[];
}
```

### `framework/resolve.ts` — ID/Slug Resolution

```ts
export type IdOrSlug = { id?: string; slug?: string };

export type ResolveResult =
  | { type: "id"; value: string }
  | { type: "slug"; value: string }
  | { error: string };

export function validateIdOrSlug(args: IdOrSlug): ResolveResult {
  if (args.id && args.slug) return { error: "Provide either id or slug, not both." };
  if (args.id) return { type: "id", value: args.id };
  if (args.slug) return { type: "slug", value: args.slug };
  return { error: "Either id or slug is required." };
}
```

Resolve is decoupled from the entity — it takes the data layer functions as parameters:

```ts
export async function resolveEntity<T>(
  db: Db,
  args: IdOrSlug,
  getById: (db: Db, id: string) => Promise<T | null>,
  getBySlug: (db: Db, slug: string) => Promise<T | null>,
  displayName?: string,
): Promise<T | { error: string }> {
  const v = validateIdOrSlug(args);
  if ("error" in v) return v;
  const entity = v.type === "id" ? await getById(db, v.value) : await getBySlug(db, v.value);
  if (!entity) {
    const label = displayName ?? "Entity";
    return { error: `${label} not found: ${v.value}` };
  }
  return entity;
}
```

### `framework/response.ts` — MCP Response Builders

```ts
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function ok(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function error(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}
```

### `framework/projection.ts` — Field Projection Engine

```ts
export function projectFields<T extends Record<string, unknown>>(
  record: T,
  config: ProjectionConfig,
  include?: string[],
): Record<string, unknown> {
  if (include?.includes("full")) return { ...record };

  const included = new Set(
    (include ?? []).flatMap((key) => config.groups[key] ?? []),
  );

  const result = { ...record };
  for (const key of config.omit) {
    if (!included.has(key)) delete result[key];
  }
  return result;
}
```

### `framework/handlers.ts` — Generic CRUD Handler Factory

The core of the framework. Given an `EntityConfig`, produces 5 typed handler functions:

```ts
export function createCrudHandlers<T extends { id: string }>(
  config: EntityConfig<T>,
) {
  const { dataLayer, hooks, projection } = config;
  const displayName = config.display;

  // Helper: resolve with entity-specific not-found message.
  function resolve(db: Db, args: IdOrSlug) {
    return resolveEntity(db, args, dataLayer.getById, dataLayer.getBySlug, displayName);
  }

  // ---- list ----
  async function handleList(ctx: ToolContext, args: Record<string, unknown>): Promise<CallToolResult> {
    const result = await dataLayer.list(ctx.db, args);
    // If paginated result
    if (result && typeof result === "object" && "items" in result) {
      const items = projection
        ? result.items.map((item) => projectFields(item as Record<string, unknown>, projection, args.include as string[] | undefined))
        : result.items;
      return ok({ [config.plural ?? config.name + "s"]: items, total: result.total });
    }
    // Simple array
    const items = result as T[];
    return ok(projection
      ? items.map((item) => projectFields(item as Record<string, unknown>, projection, args.include as string[] | undefined))
      : items,
    );
  }

  // ---- get ----
  async function handleGet(ctx: ToolContext, args: IdOrSlug): Promise<CallToolResult> {
    const resolved = await resolve(ctx.db, args);
    if ("error" in resolved) return error(resolved.error);
    const enriched = hooks?.afterGet ? await hooks.afterGet(ctx, resolved) : resolved;
    return ok(enriched);
  }

  // ---- create ----
  async function handleCreate(ctx: ToolContext, args: Record<string, unknown>): Promise<CallToolResult> {
    const input = hooks?.mapCreateInput ? hooks.mapCreateInput(args) : args;
    const entity = await dataLayer.create(ctx.db, input);
    if (hooks?.afterCreate) {
      try {
        await hooks.afterCreate(ctx, entity, args);
      } catch (err) {
        if (hooks.onCreateRollback) await hooks.onCreateRollback(ctx, entity).catch(() => {});
        const msg = err instanceof Error ? err.message : String(err);
        return error(`${displayName} created but afterCreate hook failed (rolled back): ${msg}`);
      }
    }
    return ok(entity);
  }

  // ---- update ----
  async function handleUpdate(ctx: ToolContext, args: IdOrSlug & Record<string, unknown>): Promise<CallToolResult> {
    const resolved = await resolve(ctx.db, args);
    if ("error" in resolved) return error(resolved.error);

    // Strip MCP identifier fields before any hook/mapper sees the args.
    const { id: _id, slug: _slug, ...businessFields } = args;

    let rollbackData: unknown;
    if (hooks?.beforeUpdate) {
      rollbackData = await hooks.beforeUpdate(ctx, resolved, businessFields);
    }

    try {
      // Map business fields for data layer (e.g., new_slug → slug).
      const input = hooks?.mapUpdateInput
        ? hooks.mapUpdateInput(businessFields)
        : businessFields;

      const updated = await dataLayer.update(ctx.db, resolved.id, input);
      return ok(updated);
    } catch (err) {
      if (hooks?.onUpdateRollback && rollbackData !== undefined) {
        await hooks.onUpdateRollback(ctx, resolved, rollbackData).catch(() => {});
      }
      throw err;
    }
  }

  // ---- delete ----
  async function handleDelete(ctx: ToolContext, args: IdOrSlug): Promise<CallToolResult> {
    const resolved = await resolve(ctx.db, args);
    if ("error" in resolved) return error(resolved.error);
    await dataLayer.delete(ctx.db, resolved.id);
    return ok({ deleted: true });
  }

  return { handleList, handleGet, handleCreate, handleUpdate, handleDelete };
}
```

### `framework/register.ts` — Tool Registration

```ts
export function registerEntityTools<T extends { id: string }>(
  server: McpServer,
  config: EntityConfig<T>,
  ctx: ToolContext,
): void {
  const plural = config.plural ?? config.name + "s";
  const handlers = createCrudHandlers(config);

  // ---- list ----
  server.tool(
    `list_${plural}`,
    config.descriptions?.list ?? `List all ${plural}.`,
    {
      ...config.schemas.list,
      ...(config.projection ? { include: z.array(z.string()).optional().describe("Opt-in fields excluded by default. Use 'full' for all fields.") } : {}),
    },
    (args: any) => handlers.handleList(ctx, args),
  );

  // ---- get ----
  server.tool(
    `get_${config.name}`,
    config.descriptions?.get ?? `Get a single ${config.display} by id or slug (exactly one required).`,
    { id: z.string().optional(), slug: z.string().optional() },
    (args: any) => handlers.handleGet(ctx, args),
  );

  // ---- create ----
  server.tool(
    `create_${config.name}`,
    config.descriptions?.create ?? `Create a new ${config.display}.`,
    config.schemas.create,
    (args: any) => handlers.handleCreate(ctx, args),
  );

  // ---- update ----
  server.tool(
    `update_${config.name}`,
    config.descriptions?.update ?? `Update an existing ${config.display} by id or slug (exactly one required).`,
    { id: z.string().optional(), slug: z.string().optional(), ...config.schemas.update },
    (args: any) => handlers.handleUpdate(ctx, args),
  );

  // ---- delete ----
  server.tool(
    `delete_${config.name}`,
    config.descriptions?.delete ?? `Delete a ${config.display} by id or slug (exactly one required). Irreversible.`,
    { id: z.string().optional(), slug: z.string().optional() },
    (args: any) => handlers.handleDelete(ctx, args),
  );

  // ---- extra tools ----
  for (const extra of config.extraTools ?? []) {
    server.tool(extra.name, extra.description, extra.schema, (args: any) => extra.handler(ctx, args));
  }
}
```

---

## Entity Definitions

### `entities/tag.ts`

```ts
import { z } from "zod";
import { listTags, getTagById, getTagBySlug, createTag, updateTag, deleteTag } from "@/data/tags";
import type { Tag } from "@/models/types";
import type { EntityConfig } from "../framework/types";

export const tagEntity: EntityConfig<Tag> = {
  name: "tag",
  display: "Tag",
  dataLayer: { list: listTags, getById: getTagById, getBySlug: getTagBySlug, create: createTag, update: updateTag, delete: deleteTag },
  schemas: {
    create: { name: z.string(), slug: z.string() },
    update: { name: z.string().optional(), new_slug: z.string().optional() },
  },
  hooks: {
    mapUpdateInput: (args) => {
      const { new_slug, ...rest } = args;
      return { ...rest, slug: new_slug };
    },
  },
  descriptions: {
    list: "List all tags ordered by name.",
  },
};
```

### `entities/category.ts`

```ts
export const categoryEntity: EntityConfig<Category> = {
  name: "category",
  display: "Category",
  plural: "categories",
  dataLayer: { list: listCategories, getById: getCategoryById, getBySlug: getCategoryBySlug, create: createCategory, update: updateCategory, delete: deleteCategory },
  schemas: {
    create: { name: z.string(), slug: z.string(), description: z.string().optional(), sort_order: z.number().optional() },
    update: { name: z.string().optional(), new_slug: z.string().optional(), description: z.string().nullable().optional(), sort_order: z.number().optional() },
  },
  hooks: {
    mapUpdateInput: (args) => {
      const { new_slug, ...rest } = args;
      return { ...rest, slug: new_slug };
    },
  },
  descriptions: {
    list: "List all categories ordered by sort_order then name.",
  },
};
```

### `entities/post.ts`

Posts use the full hook system + projection + extra tools:

```ts
export const postEntity: EntityConfig<PostWithCategory> = {
  name: "post",
  display: "Post",
  dataLayer: {
    list: async (db, opts) => {
      const result = await listPosts(db, { /* map opts */ });
      return { items: result.posts, total: result.total };
    },
    getById: getPostById,
    getBySlug: getPostBySlug,
    create: createPost,
    update: updatePost,
    delete: deletePost,
  },
  schemas: {
    list: {
      status: z.enum(["draft", "published", "private", "archived"]).optional(),
      category_id: z.string().optional(),
      tag_id: z.string().optional(),
      query: z.string().optional(),
      page: z.number().optional(),
      page_size: z.number().min(1).max(100).optional(),
    },
    create: {
      title: z.string(), slug: z.string(), content: z.string(),
      status: z.enum(["draft", "published", "private", "archived"]).optional(),
      excerpt: z.string().optional(), category_id: z.string().optional(),
      tag_ids: z.array(z.string()).optional(), featured_image: z.string().optional(),
      published_at: z.number().optional(),
    },
    update: {
      title: z.string().optional(), new_slug: z.string().optional(),
      content: z.string().optional(),
      status: z.enum(["draft", "published", "private", "archived"]).optional(),
      excerpt: z.string().nullable().optional(),
      category_id: z.string().nullable().optional(),
      tag_ids: z.array(z.string()).optional(),
      featured_image: z.string().nullable().optional(),
      published_at: z.number().nullable().optional(),
      reference_url: z.string().nullable().optional(),
      reference_title: z.string().nullable().optional(),
      reference_description: z.string().nullable().optional(),
      reference_image: z.string().nullable().optional(),
    },
  },
  hooks: {
    afterGet: async (ctx, post) => ({
      ...post,
      tags: await getPostTags(ctx.db, post.id),
    }),
    mapCreateInput: (args) => {
      const { tag_ids, ...rest } = args;
      return rest; // tag_ids handled in afterCreate
    },
    afterCreate: async (ctx, post, args) => {
      const tagIds = args.tag_ids as string[] | undefined;
      if (tagIds?.length) await setPostTags(ctx.db, post.id, tagIds);
    },
    onCreateRollback: async (ctx, post) => {
      await deletePost(ctx.db, post.id);
    },
    mapUpdateInput: (args) => {
      const { tag_ids, new_slug, ...rest } = args;
      return { ...rest, slug: new_slug };
    },
    beforeUpdate: async (ctx, existing, args) => {
      if (args.tag_ids === undefined) return undefined;
      const oldTags = await getPostTags(ctx.db, existing.id);
      const oldTagIds = oldTags.map((t) => t.id);
      await setPostTags(ctx.db, existing.id, args.tag_ids as string[]);
      return oldTagIds; // rollback data
    },
    onUpdateRollback: async (ctx, existing, rollbackData) => {
      if (rollbackData) await setPostTags(ctx.db, existing.id, rollbackData as string[]);
    },
  },
  projection: {
    omit: ["content", "content_html", "wp_id", "wp_permalink", "comment_enabled", "reference_description", "reference_image"],
    groups: {
      content: ["content"],
      content_html: ["content_html"],
      wp: ["wp_id", "wp_permalink"],
      comment_enabled: ["comment_enabled"],
      reference_detail: ["reference_description", "reference_image"],
    },
  },
  extraTools: [
    {
      name: "generate_excerpt",
      description: "Generate an AI-powered excerpt for a post by id or slug (exactly one required).",
      schema: { id: z.string().optional(), slug: z.string().optional() },
      // NOTE: existing handleGenerateExcerpt only takes { slug }.
      // Extra tool handlers that need ID/slug resolution must be wrapped
      // to use resolveEntity. This wrapper is written inline in the entity
      // definition — the framework does NOT auto-resolve for extra tools
      // (their arg shapes are too varied for generic handling).
      handler: async (ctx, args) => {
        const resolved = await resolveEntity(ctx.db, args, getPostById, getPostBySlug, "Post");
        if ("error" in resolved) return error(resolved.error);
        try {
          const excerpt = await generateExcerpt(resolved.title, resolved.content);
          return ok({ slug: resolved.slug, excerpt });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg === "AI not configured") return error("AI provider not configured.");
          return error(`Excerpt generation failed: ${msg}`);
        }
      },
    },
    {
      name: "unfurl_reference",
      description: "Unfurl a URL to extract metadata. Pass url alone to preview, or id/slug (with optional url) to unfurl and save to a post.",
      schema: { id: z.string().optional(), slug: z.string().optional(), url: z.string().optional() },
      // NOTE: unfurl_reference has two modes:
      //   1. Preview (url only, no id/slug) — unfurl and return, don't save
      //   2. Save (id or slug ± url) — resolve post, unfurl, save to post
      // The handler is rewritten here to support ID resolution. It replaces
      // the old handleUnfurlReference which only accepted slug.
      handler: handleUnfurlReference, // rewritten to use resolveEntity internally
    },
  ],
};
```

### Refactored `server.ts`

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { APP_VERSION } from "@/lib/version";
import type { Db } from "@/lib/db";
import type { ToolContext } from "./framework/types";
import { registerEntityTools } from "./framework/register";
import { tagEntity } from "./entities/tag";
import { categoryEntity } from "./entities/category";
import { postEntity } from "./entities/post";

export function createMcpServer(db: Db): McpServer {
  const server = new McpServer({ name: "firefly", version: APP_VERSION });
  const ctx: ToolContext = { db };

  registerEntityTools(server, tagEntity, ctx);
  registerEntityTools(server, categoryEntity, ctx);
  registerEntityTools(server, postEntity, ctx);

  return server;
}
```

From 230 LOC → ~12 LOC. All entity logic lives in the entity definitions.

---

## Testing Strategy

### Layer 1: Framework Core (Pure, Domain-Agnostic)

These tests use mock `EntityConfig` objects — no real data layer, no domain knowledge.

| File | Tests | Coverage Target |
|------|-------|-----------------|
| `framework/resolve.test.ts` | `validateIdOrSlug`: id only, slug only, both (conflict), neither (missing) | 100% branches |
| `framework/response.test.ts` | `ok()`: serializes data; `error()`: sets `isError: true` | 100% |
| `framework/projection.test.ts` | Default omit, single group include, multiple groups, `"full"` bypass, empty config | 100% |
| `framework/handlers.test.ts` | Generic CRUD with mock config: list (array + paginated), get (found + missing + id + slug + conflict), create (simple + with afterCreate + with rollback), update (simple + with hooks + rollback), delete (found + missing + id + slug) | 95%+ |

### Layer 2: Entity Definitions (Integration with Data Layer Mocks)

Test that each entity's hooks, mappers, and projection work correctly when wired to the framework.

| File | Tests |
|------|-------|
| `entities/tag.test.ts` | 5 CRUD handlers via mocked data layer; `mapUpdateInput` maps `new_slug` → `slug`; ID and slug resolution; conflict rejection |
| `entities/category.test.ts` | Same as tag; plus `plural: "categories"` naming; `sort_order` and `description` nullable handling |
| `entities/post.test.ts` | `afterGet` enriches with tags; `afterCreate` + `onCreateRollback` for tag failure; `beforeUpdate` + `onUpdateRollback` compensating write; `mapCreateInput` strips `tag_ids`; `mapUpdateInput` maps `new_slug`; projection default omit; projection with include groups; projection with `"full"`; `generate_excerpt` extra tool; `unfurl_reference` extra tool (preview + save modes) |

### Layer 3: Server Integration

| File | Tests |
|------|-------|
| `server.test.ts` | Tool count = 17; tool names match expected list; schema introspection (required fields); JSON-RPC round-trip calls |

### Layer 4: E2E

| File | Tests |
|------|-------|
| `e2e/api/mcp.test.ts` | Same existing tests + new: get by ID, conflict rejection, list_posts field projection, include full |

### Test Utilities (Shared)

Extract from the 3 duplicated test files:

```ts
// src/lib/mcp/framework/test-utils.ts
export function createMockDb(): Db { ... }
export function createMockContext(): ToolContext { ... }
export function parseToolResult(result: CallToolResult): unknown { ... }
export function expectError(result: CallToolResult, substring?: string): void { ... }
```

---

## Atomic Commits

| # | Commit | Files | Verifiable | Status |
|---|--------|-------|------------|--------|
| 1 | Add framework core: types, resolve, response, projection | `framework/types.ts`, `resolve.ts`, `response.ts`, `projection.ts` | Type-check | ✅ |
| 2 | Add framework core tests | `framework/resolve.test.ts`, `response.test.ts`, `projection.test.ts` | `pnpm test` | ✅ |
| 3 | Add generic CRUD handler factory | `framework/handlers.ts`, `framework/test-utils.ts` | Type-check | ✅ |
| 4 | Add handler factory tests | `framework/handlers.test.ts` | `pnpm test` | ✅ |
| 5 | Add registration engine | `framework/register.ts` | Type-check | ✅ |
| 6 | Add tag entity definition and migrate from tools/tags.ts | `entities/tag.ts`, `entities/tag.test.ts` | `pnpm test` | ✅ |
| 7 | Add category entity definition and migrate from tools/categories.ts | `entities/category.ts`, `entities/category.test.ts` | `pnpm test` | ✅ |
| 8 | Add post entity definition and migrate from tools/posts.ts | `entities/post.ts`, `entities/post.test.ts` | `pnpm test` | ✅ |
| 9 | Refactor server.ts to use entity registration | `server.ts`, `server.test.ts` | `pnpm test` | ✅ |
| 10 | Delete old tools/ directory | Remove `tools/` | `pnpm test` + `pnpm type-check` | ✅ |
| 11 | Add E2E tests for ID lookup and field projection | `e2e/api/mcp.test.ts` | `pnpm e2e` | ✅ |

---

## API Contract Changes

This refactor changes the public MCP tool schema. Since Firefly's MCP is consumed by a single admin user (not a public API with third-party consumers), we treat this as a **minor version bump** with no deprecation period.

### What Changes

| Tool | Before | After | Impact |
|------|--------|-------|--------|
| `get_post` | `{ slug: required }` | `{ id?: string, slug?: string }` | Breaking: `slug` is no longer required |
| `update_post` | `{ slug: required, ... }` | `{ id?: string, slug?: string, ... }` | Breaking: same |
| `delete_post` | `{ slug: required }` | `{ id?: string, slug?: string }` | Breaking: same |
| `get_tag` | `{ slug: required }` | `{ id?: string, slug?: string }` | Breaking: same |
| `update_tag` | `{ slug: required, ... }` | `{ id?: string, slug?: string, ... }` | Breaking: same |
| `delete_tag` | `{ slug: required }` | `{ id?: string, slug?: string }` | Breaking: same |
| `get_category` | `{ slug: required }` | `{ id?: string, slug?: string }` | Breaking: same |
| `update_category` | `{ slug: required, ... }` | `{ id?: string, slug?: string, ... }` | Breaking: same |
| `delete_category` | `{ slug: required }` | `{ id?: string, slug?: string }` | Breaking: same |
| `generate_excerpt` | `{ slug: required }` | `{ id?: string, slug?: string }` | Breaking: same |
| `unfurl_reference` | `{ slug?: string, url?: string }` | `{ id?: string, slug?: string, url?: string }` | Additive (slug was already optional) |
| `list_posts` | no `include` param | `{ ..., include?: string[] }` | Additive |

**Backward compatibility:** All existing calls using `{ slug: "..." }` continue to work exactly as before. The only "breaking" aspect is that `slug` moves from `required` to `optional` in the Zod schema, which means AI clients may attempt to call without either identifier. The handler validates "at least one" and returns a clear error.

### Tests That Must Update

| Test file | Change needed |
|-----------|--------------|
| `src/lib/mcp/server.test.ts` | Schema introspection assertions: `get_tag.inputSchema.required` no longer contains `["slug"]` — it should be `undefined` or `[]`. Tool count stays 17. |
| `e2e/api/mcp.test.ts` | Existing tests pass unchanged (they all provide `slug`). New tests added for ID paths. |

### Version Impact

Bump `APP_VERSION` (minor) to signal the schema change. The `tools/list` response includes the version, so MCP clients can detect the capability.

---

## Future Extraction Path

This doc focuses on the **in-project refactor**. The framework is designed with extraction in mind — the `framework/` directory has zero domain imports. Future extraction to a standalone package:

```
@hexly/mcp-entity
├── types.ts          # EntityConfig, DataLayer, Hooks
├── resolve.ts        # ID/slug resolution
├── response.ts       # MCP response builders
├── projection.ts     # Field projection
├── handlers.ts       # Generic CRUD factory
├── register.ts       # Tool registration
└── test-utils.ts     # Shared test helpers

@hexly/mcp-oauth-nextjs
├── auth.ts           # Token validation, origin check
├── oauth.ts          # PKCE, metadata, loopback check
├── routes/           # Next.js route handlers (parameterized)
└── data/             # Token/client/auth-code storage interface
```

Injection points already identified in this design:
- `Db` interface — the data layer boundary
- `EntityConfig` — the entity declaration contract
- Auth provider — pluggable via `{ getUser, loginUrl, isAuthorized }` interface
- Token prefix / branding — config parameter
- Scope model — config parameter

---

## Verification

```bash
# After each commit:
pnpm type-check          # L2 — zero type errors
pnpm test                # L1 — all unit tests pass
pnpm lint                # L2 — zero warnings

# After commit 10 (full migration):
pnpm test -- --coverage  # Verify 95%+ coverage on framework/ and entities/

# After commit 11:
pnpm e2e                 # L3 — E2E against running worker
```
