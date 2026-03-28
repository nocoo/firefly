# 20 — Entity Data Layer Refactoring

> Full rewrite of the data layer. Unify all entity CRUD into abstract infrastructure, introduce Service layer for cross-entity orchestration, normalize Worker API, and achieve 100% core / 95%+ entity test coverage. New Worker runs in parallel; switch over when ready.

## Table of Contents

1. [Motivation](#1-motivation)
2. [Design Decisions](#2-design-decisions)
3. [Architecture Overview](#3-architecture-overview)
4. [Core Infrastructure](#4-core-infrastructure)
5. [Entity Definitions](#5-entity-definitions)
6. [Service Layer](#6-service-layer)
7. [MCP Framework Changes](#7-mcp-framework-changes)
8. [Worker API Normalization](#8-worker-api-normalization)
9. [REST API Route Migration](#9-rest-api-route-migration)
10. [Migration Plan](#10-migration-plan)
11. [Test Strategy](#11-test-strategy)
12. [Atomic Commits](#12-atomic-commits)
13. [File Manifest](#13-file-manifest)

---

## 1. Motivation

### 1.1 Copy-Paste CRUD

Five entity files repeat identical patterns — dynamic UPDATE builder (5 copies), ULID + timestamp generation (5 copies), no-op guard (5 copies), get-by-slug/get-by-id pairs (4 copies). These are mechanical utilities that should exist once.

### 1.2 Three Disconnected CRUD Stacks

| Stack | Where | Problem |
|-------|-------|---------|
| Data Layer | `src/data/*.ts` | Raw SQL, no shared abstraction |
| MCP Entity Framework | `src/lib/mcp/framework/` + `entities/` | Has its own `DataLayer<T>` + hooks + rollback — duplicates business logic |
| REST API Routes | `src/app/api/*/route.ts` | Manually calls data functions, repeats tag association logic |

**The same `setPostTags` call** appears in REST route handlers (`posts/route.ts:87`, `posts/[slug]/route.ts:57`) AND in MCP hooks (`mcp/entities/post.ts:204`, `post.ts:220`). Two independent implementations of the same cross-entity orchestration.

### 1.3 Post Read Model Entangled with Base Queries

`getPostBySlug` and `getPostById` return `PostWithCategory` via `LEFT JOIN categories` (posts.ts:220-227). Public API adds a `status = "published"` filter (posts/[slug]/route.ts:24). A generic `BaseDataLayer.getById` doing `SELECT * FROM table WHERE id = ?` cannot serve this — Post's reads need JOINs and conditional filters.

### 1.4 Value-Dependent Side Effects

Post writes trigger cascading updates that depend on **comparing old vs new values**:
- Category change → refresh **both** old and new category `post_count` (posts.ts:455-466)
- Status change → refresh **all** tag `post_count` + invalidate archives (posts.ts:469-472)

This isn't a simple "on write, invalidate cache" — it's domain logic that inspects the diff.

### 1.5 Inconsistent API Surface

Auth varies (none / proxy / session), error handling varies (raw catch vs `handleError`), response shapes vary (204 vs JSON), default page sizes vary (120 vs data layer default).

---

## 2. Design Decisions

Six key decisions drive the entire architecture:

### D1: Service Layer for Best-Effort Orchestration

**Problem:** `setPostTags` is called by REST routes and MCP hooks independently — two copies of the same orchestration logic.

**Decision:** Introduce `PostService` above the data layer. It orchestrates the full write flow: `createPost` + `setPostTags` + `refreshCategoryPostCount`. REST routes and MCP both call `PostService` — neither knows about tag association internals.

```
REST Route ──→ PostService.create(input) ──→ data layer primitives
MCP Server ──→ PostService.create(input) ──→ data layer primitives
                     ↓
              setPostTags + refreshCounts (internal)
```

**Atomicity constraint:** The current `Db` abstraction only supports single `execute` calls and `batch` (D1 atomic batch of independent SQL statements via a single HTTP request). There is no cross-call transaction — no BEGIN/COMMIT/ROLLBACK spanning multiple HTTP round-trips to the Worker. This means `createPost → setPostTags → refreshCounts` is **not an atomic transaction**; any step can fail leaving partial state.

**Mitigation — maximize `batch` usage:**
- `setPostTags` already uses `db.batch()` for its DELETE + INSERT (atomic within one HTTP call)
- Where possible, combine related writes into a single `batch` call (e.g., post INSERT + tag INSERTs in one batch)
- Count refreshes (`refreshCategoryPostCount`, `refreshAllTagPostCounts`) are **idempotent** — re-running them always converges to the correct count regardless of partial failure. This is the safety net.

**Failure modes and compensations:**

| Failure Point | State Left Behind | Compensation |
|---------------|-------------------|--------------|
| `createPost` fails | Nothing created | No action needed |
| `setPostTags` fails after `createPost` | Post exists, no tags | Post is usable; tags can be set on next update |
| `refreshCounts` fails after above | Post + tags exist, stale counts | Counts auto-converge on next write to any post/tag; also fixable by admin manual trigger |

This is **best-effort orchestration with idempotent compensation**, not a database transaction. The document uses "orchestration" throughout — never "transaction."

### D6: Return Semantics for Best-Effort Orchestration

**Problem:** If `PostService.create` succeeds at `createPost` but fails at `setPostTags`, what does the caller see? If the service throws, the API returns an error — but the post already exists. The client retries and hits a slug conflict. The external behavior is "failed, but it actually succeeded (partially)."

**Decision:** Split the orchestration into **primary write** (the entity itself) and **secondary effects** (tags, counts, caches). The contract:

| Outcome | Service Behavior | HTTP Status | Response |
|---------|-----------------|-------------|----------|
| Primary write fails | Throw → caller returns error | 500 | `{ error: "..." }` |
| Primary write succeeds, secondary effect fails | **Log error, return the entity** | 200/201 | `{ ...entity }` (normal success) |
| All steps succeed | Return the entity | 200/201 | `{ ...entity }` |

**Rationale:**
1. The **primary write is the truth** — if the post exists in DB, the operation succeeded from the user's perspective.
2. Secondary effects (tags, counts) are **eventually consistent** — they auto-converge on the next write, or can be manually triggered by admin.
3. Throwing on secondary failure forces the client to handle a "failed but actually created" state, which is worse than a clean success with degraded secondary data.
4. The service logs the secondary failure at `error` level, so it's observable and actionable.

**Implementation pattern:**
```ts
// PostService.create
async function create(db: Db, input: CreatePostInput): Promise<PostWithCategory> {
  // Primary write — failure here throws, caller gets error, nothing was created
  const post = await postData.create(db, input);

  // Secondary effects — failure here is logged, NOT thrown
  try {
    if (input.tagIds?.length) {
      await postData.setPostTags(db, post.id, input.tagIds);
    }
  } catch (e) {
    log.error("setPostTags failed after createPost", { postId: post.id, error: e });
    // NOT re-thrown — post was created successfully
  }

  try {
    await postData.refreshCategoryPostCount(db, post.category_id);
    await postData.refreshAllTagPostCounts(db);
  } catch (e) {
    log.error("count refresh failed", { postId: post.id, error: e });
    // Idempotent — will auto-correct on next write
  }

  postData.invalidatePostCaches();
  return post;
}
```

**Same pattern for update/delete:** primary mutation is the UPDATE/DELETE; tag re-association + count refreshes are secondary. If the primary mutation fails, throw. If secondary effects fail, log and return success.

### D2: `viewQuery` Pattern for JOIN Reads

**Problem:** Post's `getById`/`getBySlug` need `LEFT JOIN categories` returning `PostWithCategory`. A generic base layer does `SELECT * FROM table`.

**Decision:** `EntityConfig` includes an optional `viewQuery` — a SELECT statement (with JOINs) that the base layer uses for all read operations instead of `SELECT * FROM {table}`. Simple entities omit it and get the default single-table query.

```ts
// Tag: no viewQuery → base uses "SELECT * FROM tags"
// Post: viewQuery → base uses "SELECT p.*, c.name AS category_name, c.slug AS category_slug
//                               FROM posts p LEFT JOIN categories c ON p.category_id = c.id"
```

For `getBySlug`, the base layer appends `WHERE slug = ?` to the viewQuery. Post's optional status filter is handled via a `resolveFilters` mechanism — the entity config declares additional optional WHERE conditions.

### D3: MCP Demoted to Passthrough

**Problem:** MCP's `afterCreate`/`beforeUpdate` hooks duplicate business logic (tag association, rollback). If data layer hooks also exist, they double-fire.

**Decision:** MCP entity configs drop all business hooks (`afterCreate`, `beforeUpdate`, `onCreateRollback`, `onUpdateRollback`). MCP keeps only:
- `mapCreateInput` / `mapUpdateInput` — transport field mapping (`new_slug` → `slug`)
- `afterGet` — response enrichment (add `tags` array to post)
- `projection` — field omission for list responses

Business logic lives exclusively in the Service layer. MCP calls the Service, not the raw data layer. The MCP framework's rollback mechanism becomes dead code and is removed.

### D4: Data Layer Functions are Pure Primitives

**Problem:** Current `setPostTags` internally calls `refreshAllTagPostCounts()`. Current `batchUpdatePosts` internally refreshes categories, tags, archives, and count caches. If PostService also calls these refresh functions, side effects fire twice.

**Decision:** Data layer entity functions are **pure data primitives** — they write to exactly the table(s) they own and nothing more. All cross-entity side effects (count refreshes, cache invalidation) are **exclusively owned by the Service layer**.

| Function | Current (data layer does side effects) | New (pure primitive) |
|----------|---------------------------------------|----------------------|
| `setPostTags(db, postId, tagIds)` | DELETE + INSERT + `refreshAllTagPostCounts()` | DELETE + INSERT only |
| `batchUpdatePosts(db, ids, updates)` | UPDATE + refresh categories/tags/archives/count | UPDATE only |
| `deletePost(db, id)` | DELETE + refresh category/tags/archives/count | DELETE only |
| `createPost(db, input)` | INSERT + `refreshCategoryPostCount()` | INSERT only |
| `updatePost(db, id, input)` | UPDATE + refresh old/new category + tags + archives | UPDATE only |

The Service layer owns the full sequence:
```
PostService.create:
  1. postData.create(db, input)           ← pure INSERT
  2. postData.setPostTags(db, id, tags)   ← pure DELETE + INSERT (batched)
  3. postData.refreshCategoryPostCount()  ← Service calls this, not data layer
  4. postData.refreshAllTagPostCounts()   ← Service calls this, not data layer
  5. invalidate caches                    ← Service calls this
```

**Boundary rule:** If a function in `src/data/entities/*.ts` calls another function from a different entity's namespace, it's a Service-layer concern and must be lifted out.

### D5: Input Key Convention — camelCase for Input, snake_case for Domain/Output

**Problem:** DB columns are `snake_case` (`r2_key`, `mime_type`, `post_id`). Current `CreateMediaInput` uses `camelCase` (`r2Key`, `mimeType`). `EntityConfig.fields` keys map to DB columns. If input keys, field map keys, and column names each use different conventions, every layer needs a mapper.

**Decision:** Two conventions, clear boundary:

| Layer | Convention | Example | Rationale |
|-------|-----------|---------|-----------|
| **DB columns** | `snake_case` | `r2_key`, `mime_type` | Schema unchanged |
| **Domain types (read model)** | `snake_case` | `Post.category_id`, `Attachment.r2_key` | Match DB — `SELECT *` returns snake_case, `src/models/types.ts` unchanged |
| **API response JSON** | `snake_case` | `{ "category_id": "..." }` | No breaking change for consumers |
| **EntityConfig.fields keys** | `camelCase` | `r2Key`, `mimeType` | Input-oriented — maps camelCase input to snake_case column |
| **FieldDef.column** | `snake_case` | `{ column: "r2_key" }` | Maps to DB |
| **Service / Route input types** | `camelCase` | `{ r2Key, mimeType, categoryId }` | Developer ergonomics for write operations |
| **BaseDataLayer input** | `camelCase` | Same as Service | FieldDef bridges to SQL |

**Key boundary:** The `FieldDef` struct bridges input (camelCase) to DB (snake_case). This bridge is **only for writes**. Reads go through `SELECT *` → D1 returns snake_case column names → domain types match → no mapping needed.

**Consequence:** Service layer code accessing **read results** (domain types) uses `snake_case`:
```ts
// Correct — post is Post type (snake_case from DB)
post.category_id   // ✓
post.content_html   // ✓
media.r2_key        // ✓

// Input types use camelCase
const input: CreatePostInput = { categoryId: "...", featuredImage: "..." };
```

**Exception:** For entities where current input types already use `snake_case` (e.g., `category_id` in `CreatePostInput`), we migrate to `camelCase` (`categoryId`). REST API request bodies and MCP args continue accepting `snake_case` from external clients — the route/MCP layer maps once at the boundary.

**What stays unchanged:**
- `src/models/types.ts` — all domain interfaces stay snake_case, zero edits
- API response JSON shape — no change for any consumer
- `PostWithCategory.category_name`, `PostWithCategory.category_slug` — snake_case as returned by SQL alias

---

## 3. Architecture Overview

### Layer Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Consumers                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ REST API │  │ MCP      │  │ Server Components    │  │
│  │ Routes   │  │ Server   │  │ (blog pages, admin)  │  │
│  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘  │
└───────┼──────────────┼───────────────────┼──────────────┘
        │              │                   │
        ▼              ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│  Service Layer (NEW)                                    │
│  ┌──────────────┐  ┌────────────────┐                   │
│  │ PostService  │  │ MediaService   │                   │
│  │ • create     │  │ • upload       │                   │
│  │ • update     │  │ • delete (+R2) │                   │
│  │ • delete     │  └────────────────┘                   │
│  │ • setTags    │                                       │
│  │ • batch      │  (Tag/Category/Comment: no service    │
│  └──────────────┘   needed — simple CRUD, go direct)    │
└───────┬─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│  Data Layer (REWRITTEN)                                 │
│  ┌─────────────────────────────────┐                    │
│  │ BaseDataLayer<T>                │                    │
│  │ • list(options)                 │                    │
│  │ • getById(id)     ← viewQuery  │                    │
│  │ • getBySlug(slug) ← viewQuery  │                    │
│  │ • create(input)                 │                    │
│  │ • update(id, input)             │                    │
│  │ • delete(id)                    │                    │
│  └──────────┬──────────────────────┘                    │
│             │                                           │
│  ┌──────────┴──────────┐                                │
│  │ EntityConfig<T>     │                                │
│  │ • table, fields     │                                │
│  │ • viewQuery         │                                │
│  │ • hooks (data only) │                                │
│  │ • cache policy      │                                │
│  └─────────────────────┘                                │
│                                                         │
│  core/sql.ts  core/timestamps.ts  core/cache-manager.ts │
└───────┬─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│  Database Client (src/lib/db.ts)                        │
│  query / firstOrNull / execute / batch                  │
└───────┬─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Worker (NEW deployment, /api/v1/*)          │
│  D1 Database                                            │
└─────────────────────────────────────────────────────────┘
```

### Which entities need a Service layer?

| Entity | Service? | Why |
|--------|----------|-----|
| **Post** | ✅ `PostService` | Tag association, content rendering, category/tag count refresh, status transitions |
| **Media** | ✅ `MediaService` | R2 upload/delete orchestration (storage + DB) |
| **Category** | ❌ | Pure CRUD + cache invalidation, no cross-entity logic |
| **Tag** | ❌ | Pure CRUD + cache invalidation |
| **Comment** | ❌ | Read-only |

Simple entities (Tag, Category, Comment) are consumed directly from the data layer. No service wrapper needed.

---

## 4. Core Infrastructure

### 4.1 Directory Structure

```
src/data/
├── core/
│   ├── types.ts              # BaseEntity, EntityConfig<T>, FieldDef, etc.
│   ├── sql.ts                # buildSetClauses, buildInsert, buildWhere, buildOrderBy, buildPagination
│   ├── sql.test.ts
│   ├── base-data-layer.ts    # Generic CRUD: list, getById, getBySlug, create, update, delete
│   ├── base-data-layer.test.ts
│   ├── cache-manager.ts      # EntityCacheManager
│   ├── cache-manager.test.ts
│   ├── timestamps.ts         # nowEpoch(), newId()
│   ├── timestamps.test.ts
│   └── test-utils.ts         # createMockDb, expectSql (shared across all tests)
```

### 4.2 Core Types (`core/types.ts`)

```ts
/** Unix epoch seconds */
type EpochSeconds = number;

/** All entities have at least an id and created_at */
interface BaseEntity {
  id: string;
  created_at: EpochSeconds;
}

/** Paginated list result */
interface PaginatedResult<T> {
  items: T[];
  total: number;
}

/** List query options */
interface ListOptions {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
}

/** Field definition for dynamic UPDATE — key is camelCase (D5), column is snake_case */
interface FieldDef {
  /** DB column name (snake_case) */
  column: string;
  /** If true, null means "clear this field" (SET col = NULL).
   *  If false/omitted, null still passes through to DB — let the constraint reject it.
   *  This matches current behavior exactly. */
  nullable?: boolean;
}

/** Data-layer hooks — input enrichment only, NO cross-entity side effects (D4) */
interface DataHooks<T> {
  /** Enrich input before INSERT (e.g., compute readingTime, contentHtml) */
  beforeCreate?: (db: Db, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Enrich input before UPDATE (e.g., recompute contentHtml when content changes) */
  beforeUpdate?: (db: Db, existing: T, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

/** Complete entity configuration */
interface EntityConfig<T extends BaseEntity> {
  /** SQL table name */
  table: string;
  /** Display name for error messages */
  displayName: string;
  /** Has an updated_at column? (Attachment doesn't) */
  hasUpdatedAt: boolean;
  /** Has a slug column for lookup? */
  hasSlug: boolean;
  /** Field map for dynamic UPDATE: camelCase inputKey → FieldDef (D5) */
  fields: Record<string, FieldDef>;
  /** Column names for INSERT — uses camelCase keys matching fields (D5).
   *  id, created_at, updated_at are auto-handled by BaseDataLayer. */
  insertColumns: string[];
  /** Default ORDER BY clause content (without the "ORDER BY" keyword).
   *  Supports multi-column: "sort_order DESC, name ASC".
   *  Single-column: "name ASC". */
  defaultOrderBy: string;
  /** List mode:
   *  - "all": list() returns T[] (full array, no pagination). Used by Tag, Category.
   *  - "paginated": list() returns PaginatedResult<T>. Used by Post, Media.
   *  Default: "paginated" */
  listMode?: "all" | "paginated";
  /** Optional: SELECT statement for reads (with JOINs). Omit for "SELECT * FROM {table}".
   *  When defined, `tableAlias` MUST also be set. */
  viewQuery?: string;
  /** Required when viewQuery is defined. The alias of the primary table in the viewQuery.
   *  Used by getById/getBySlug/update/remove to qualify column references:
   *  e.g., "p" → WHERE p.id = ?, WHERE p.slug = ?
   *  Omit for simple entities (no viewQuery) — BaseDataLayer uses bare "id"/"slug". */
  tableAlias?: string;
  /** Optional: additional WHERE conditions for getBySlug resolve.
   *  E.g., Post's public resolve needs status = 'published'.
   *  Key = condition name, Value = { clause, params } */
  resolveFilters?: Record<string, { clause: string; params: unknown[] }>;
  /** Data-layer hooks */
  hooks?: DataHooks<T>;
  /** Cache policy — only used when listMode is "all" (cache the full array) */
  cache?: { ttl: number };
  /** Custom list implementation (for complex JOINs/filters like Post, Media).
   *  Only valid when listMode is "paginated". Overrides default pagination query. */
  customList?: (db: Db, options: any) => Promise<PaginatedResult<T>>;
}
```

### 4.3 SQL Utilities (`core/sql.ts`)

**`buildSetClauses(input, fieldMap)`** — Replaces 5 copy-pasted dynamic UPDATE builders.

Behavioral spec:
1. For each `[inputKey, fieldDef]` in `fieldMap`:
   - `undefined` → skip (no change requested)
   - `null` → emit `"column = ?"` with param `null` (always — let DB constraint handle it)
   - any value → emit `"column = ?"` with the value
2. Does NOT append `updated_at` — caller decides (some entities lack it)
3. Returns `{ setClauses: string[], params: unknown[] }` — empty arrays for no-op

**`buildInsert(table, columns, values)`** → `{ sql, params }`

**`buildWhere(conditions: { clause: string; params: unknown[] }[])`** → `{ clause, params }` — joins with AND, returns empty string if no conditions.

**`buildPagination(page, pageSize)`** → `{ clause, params }` — LIMIT + OFFSET.

**`buildOrderBy(column, direction, allowedColumns)`** → string — validates single-column runtime override against whitelist. Used only by paginated list path when caller provides `ListOptions.orderBy`. Not used for `defaultOrderBy` (which is a static SQL clause).

### 4.4 Timestamps (`core/timestamps.ts`)

```ts
function nowEpoch(): number;  // Math.floor(Date.now() / 1000)
function newId(): string;     // ulid()
```

### 4.5 Cache Manager (`core/cache-manager.ts`)

Wraps existing `createCache<T>`:

```ts
class EntityCacheManager<T> {
  constructor(ttl: number);
  get(): T | null;
  set(value: T): void;
  invalidate(): void;
}
```

No cascade registry — Post's value-dependent invalidation stays in its data hooks / service layer, explicit and inspectable.

### 4.6 Base Data Layer (`core/base-data-layer.ts`)

```ts
// listMode: "all" → returns T[]; listMode: "paginated" → returns PaginatedResult<T>
async function list<T>(db, config, options?): Promise<T[] | PaginatedResult<T>>;
async function getById<T>(db, config, id): Promise<T | null>;
async function getBySlug<T>(db, config, slug, resolveFilter?): Promise<T | null>;
async function create<T>(db, config, input): Promise<T>;
async function update<T>(db, config, id, input): Promise<T | null>;
async function remove<T>(db, config, id): Promise<boolean>;
```

**`list`:** Behavior depends on `config.listMode`:
- `"all"` (Tag, Category): Executes `SELECT * FROM {table} ORDER BY {defaultOrderBy}`, returns `T[]`. Checks cache first if `config.cache` is defined.
- `"paginated"` (Post, Media, default): If `config.customList` is defined, delegates to it. Otherwise builds `SELECT * FROM {table}` with pagination + ordering, returns `PaginatedResult<T>`.

**`getById` / `getBySlug`:** Uses `config.viewQuery` if defined, otherwise `SELECT * FROM {table}`. Appends WHERE clause using qualified column names:
- If `config.tableAlias` is defined (viewQuery entities): `WHERE {alias}.id = ?` / `WHERE {alias}.slug = ?`
- Otherwise (simple entities): `WHERE id = ?` / `WHERE slug = ?`

If `resolveFilter` is provided (e.g., `"published"`), appends the corresponding filter from `config.resolveFilters`.

```ts
// Post (has viewQuery + tableAlias "p"):
//   SELECT p.*, c.name AS ... FROM posts p LEFT JOIN categories c ON ...
//   WHERE p.slug = ? AND p.status = ?
//
// Tag (no viewQuery, no tableAlias):
//   SELECT * FROM tags WHERE slug = ?
```

**`create`:**
1. `newId()` + `nowEpoch()` for id and timestamps
2. `hooks.beforeCreate` if defined (input enrichment only — D4)
3. `buildInsert` + execute (uses `fieldDef.column` for SQL column names)
4. Fetch back via `getById`
5. Return entity

**`update`:**
1. Fetch existing entity via `getById` (needed for beforeUpdate hook that compares old vs new)
2. `hooks.beforeUpdate` if defined (input enrichment, returns transformed input — D4)
3. `buildSetClauses` + append `updated_at` if `hasUpdatedAt`
4. No-op if no clauses → return existing
5. Execute `UPDATE {table} SET ... WHERE id = ?` (plain table, no alias — UPDATE doesn't use viewQuery)
6. Fetch back via `getById` (uses viewQuery for POST's JOIN read)
7. Return updated entity

**`remove`:**
1. Execute `DELETE FROM {table} WHERE id = ?` (plain table, no alias)
2. Return `changes > 0`

**Note:** No `afterCreate`, `afterUpdate`, `afterDelete`, `beforeDelete` hooks in BaseDataLayer. Per D4, all side effects (cache invalidation, count refresh, tag association) are owned by the Service layer. BaseDataLayer is a pure CRUD machine.

---

## 5. Entity Definitions

### 5.1 Tag (`src/data/entities/tag.ts`)

Simplest entity — pure CRUD, cached list.

```ts
const tagConfig: EntityConfig<Tag> = {
  table: "tags",
  displayName: "Tag",
  hasUpdatedAt: true,
  hasSlug: true,
  fields: {
    name: { column: "name" },
    slug: { column: "slug" },
  },
  insertColumns: ["name", "slug"],
  defaultOrderBy: "name ASC",
  listMode: "all",
  cache: { ttl: 5 * 60 * 1000 },
};
```

Exports: `listTags`, `getTagBySlug`, `getTagById`, `createTag`, `updateTag`, `deleteTag` — thin wrappers calling `BaseDataLayer` with `tagConfig`. `listTags` returns `Tag[]` (full array, cached per `listMode: "all"`). Each write function invalidates the tag cache after the base layer call returns (simple inline invalidation — no Service needed for single-entity cache).

~60 lines (was 146).

### 5.2 Category (`src/data/entities/category.ts`)

Standard CRUD + two extra functions. Per D5, field keys are camelCase.

```ts
const categoryConfig: EntityConfig<Category> = {
  table: "categories",
  displayName: "Category",
  hasUpdatedAt: true,
  hasSlug: true,
  fields: {
    name: { column: "name" },
    slug: { column: "slug" },
    description: { column: "description" },
    sortOrder: { column: "sort_order" },
  },
  insertColumns: ["name", "slug", "description", "sortOrder"],
  defaultOrderBy: "sort_order DESC, name ASC",
  listMode: "all",
  cache: { ttl: 5 * 60 * 1000 },
};
```

Exports: standard CRUD + `reorderCategories(db, ids)` (batch, unchanged) + `listCategoriesWithPostStats(db)` (custom JOIN, unchanged). `listCategories` returns `Category[]` (full array, cached per `listMode: "all"`). Each write function invalidates the category cache inline.

~100 lines (was 224).

### 5.3 Post (`src/data/entities/post.ts`)

Complex entity with viewQuery and data-level hooks. Per D4, all functions are **pure data primitives** — no cross-entity side effects.

```ts
const postConfig: EntityConfig<PostWithCategory> = {
  table: "posts",
  displayName: "Post",
  hasUpdatedAt: true,
  hasSlug: true,
  viewQuery: `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM posts p
    LEFT JOIN categories c ON p.category_id = c.id
  `,
  tableAlias: "p",
  resolveFilters: {
    published: { clause: "p.status = ?", params: ["published"] },
  },
  fields: {
    title: { column: "title" },
    slug: { column: "slug" },
    content: { column: "content" },
    contentHtml: { column: "content_html" },
    excerpt: { column: "excerpt", nullable: true },
    status: { column: "status" },
    categoryId: { column: "category_id", nullable: true },
    featuredImage: { column: "featured_image", nullable: true },
    commentEnabled: { column: "comment_enabled" },
    readingTime: { column: "reading_time" },
    publishedAt: { column: "published_at", nullable: true },
    referenceUrl: { column: "reference_url", nullable: true },
    referenceTitle: { column: "reference_title", nullable: true },
    referenceDescription: { column: "reference_description", nullable: true },
    referenceImage: { column: "reference_image", nullable: true },
  },
  insertColumns: [
    "title", "slug", "content", "contentHtml", "excerpt", "status",
    "categoryId", "featuredImage", "commentEnabled", "readingTime",
    "publishedAt", "referenceUrl", "referenceTitle",
    "referenceDescription", "referenceImage",
  ],
  defaultOrderBy: "published_at DESC",
  customList: listPostsQuery,  // Complex WHERE builder with JOIN + filters
  hooks: {
    beforeCreate: async (db, input) => {
      // Compute: readingTime, contentHtml (renderMarkdown), excerpt (excerptFromContent)
      // Auto-set publishedAt for status "published" if not provided
      return enrichedInput;
    },
    beforeUpdate: async (db, existing, input) => {
      // If content changed → recompute readingTime, contentHtml, auto-excerpt
      // If excerpt === null → auto-regenerate
      // If referenceUrl === null → cascade clear referenceTitle/Description/Image
      // Auto-set publishedAt on status transition to "published"
      return enrichedInput;
    },
    // NO afterCreate, afterUpdate, afterDelete hooks.
    // All cross-entity side effects (category count, tag count, tag association,
    // cache invalidation) are exclusively owned by PostService (D4).
  },
};
```

**`viewQuery` in action:**
- `getPostById(db, id)` → base layer runs: `{viewQuery} WHERE p.id = ?`
- `getPostBySlug(db, slug)` → base layer runs: `{viewQuery} WHERE p.slug = ?`
- `getPostBySlug(db, slug, "published")` → base layer runs: `{viewQuery} WHERE p.slug = ? AND p.status = ?`

**Exports — all pure primitives (no side effects):**
- Base CRUD: `create`, `update`, `remove`, `getById`, `getBySlug`, `list`
- `getPostTags(db, postId)` — M:N join query (read-only)
- `setPostTags(db, postId, tagIds)` — atomic batch DELETE + INSERT via `db.batch()`. **No count refresh** (was: called `refreshAllTagPostCounts`, now lifted to Service)
- `batchUpdatePosts(db, ids, updates)` — bulk UPDATE. **No side effects** (was: refreshed categories/tags/archives/count, now lifted to Service)
- `refreshCategoryPostCount(db, categoryId)` — idempotent single-category count recalc: `UPDATE categories SET post_count = (SELECT COUNT(*) FROM posts WHERE category_id = ? AND status = 'published') WHERE id = ?`
- `refreshAllCategoryPostCounts(db)` — idempotent **global** category count recalc: runs `refreshCategoryPostCount` for every category in a single batch. Needed by `PostService.batchUpdate` which can affect multiple categories in one call.
- `refreshAllTagPostCounts(db)` — idempotent global tag count recalc (called by Service, not internally)
- `listMonthlyArchives(db)` — aggregation (cached)
- `listPostYears(db)` — aggregation
- `getAdjacentPosts(db, post)` — prev/next
- `invalidatePostCaches()` — invalidates **all** post-related caches: post list cache, count cache, **and** archives cache. Called by Service after orchestration completes. This is a single function that covers everything — Service methods never need to call separate archive/count invalidation.

~400 lines (was 763).

### 5.4 Media (`src/data/entities/media.ts`)

No `updated_at`, custom list query, no update operation. Per D5, field keys are camelCase.

```ts
const mediaConfig: EntityConfig<Attachment> = {
  table: "attachments",
  displayName: "Media",
  hasUpdatedAt: false,
  hasSlug: false,
  fields: {
    filename:  { column: "filename" },
    r2Key:     { column: "r2_key" },
    mimeType:  { column: "mime_type" },
    size:      { column: "size" },
    width:     { column: "width" },
    height:    { column: "height" },
    altText:   { column: "alt_text", nullable: true },
    postId:    { column: "post_id", nullable: true },
  },
  insertColumns: ["filename", "r2Key", "mimeType", "size", "width", "height", "postId"],
  defaultOrderBy: "created_at DESC",
  customList: listMediaQuery,
};
```

Exports: `listMedia`, `getMedia`, `createMedia`, `deleteMedia` + `listMediaByPost`, `associateMedia`, `batchCreateMedia`, `listMediaYears`.

~150 lines (was 271).

### 5.5 Comment (`src/data/entities/comment.ts`)

Read-only. No create/update/delete.

Exports: `listCommentsByPost(db, postId)` + `buildCommentTree(comments)` (pure function).

~35 lines (was 50).

---

## 6. Service Layer

### 6.1 PostService (`src/services/post-service.ts`)

The **single source of truth** for all post write orchestration. Every consumer (REST, MCP, admin) calls PostService — none directly calls `createPost` + `setPostTags` separately. Data layer functions are pure primitives (D4); PostService owns all side effects.

```ts
import type { Db } from "@/lib/db";
import type { PostWithCategory, PostWithTags } from "@/models/types";
import * as postData from "@/data/entities/post";

interface CreatePostInput {
  title: string;
  slug: string;
  content: string;
  status?: PostStatus;
  excerpt?: string | null;
  categoryId?: string | null;
  featuredImage?: string | null;
  commentEnabled?: 0 | 1;
  publishedAt?: number | null;
  tagIds?: string[];
  referenceUrl?: string | null;
  referenceTitle?: string | null;
  referenceDescription?: string | null;
  referenceImage?: string | null;
}

interface UpdatePostInput {
  title?: string;
  slug?: string;
  content?: string;
  status?: PostStatus;
  excerpt?: string | null;
  categoryId?: string | null;
  featuredImage?: string | null;
  commentEnabled?: 0 | 1;
  publishedAt?: number | null;
  tagIds?: string[];
  referenceUrl?: string | null;
  referenceTitle?: string | null;
  referenceDescription?: string | null;
  referenceImage?: string | null;
}
```

**`PostService.create(db, input)`** — best-effort orchestration (D1, D6):
1. Extract `tagIds` from input
2. Call `postData.create(db, restOfInput)` — **primary write**, throws on failure
3. If `tagIds` provided → `postData.setPostTags(db, post.id, tagIds)` — secondary, catch + log
4. `postData.refreshCategoryPostCount(db, post.category_id)` — secondary, catch + log
5. `postData.refreshAllTagPostCounts(db)` — secondary, catch + log
6. `postData.invalidatePostCaches()`
7. Return post (**always returns if primary write succeeded**, per D6)

**`PostService.update(db, id, input)`** — value-dependent side effects (D6):
1. `postData.getById(db, id)` — fetch existing for old vs new comparison
2. Extract `tagIds` from input
3. `postData.update(db, id, restOfInput)` — **primary write**, throws on failure
4. If `tagIds` provided → `postData.setPostTags(db, id, tagIds)` — secondary, catch + log
5. Compare old vs new (secondary, catch + log):
   - If `category_id` changed → refresh **old** + **new** category counts
   - If `status` changed → `refreshAllTagPostCounts`
6. `postData.invalidatePostCaches()` — covers list, count, and archives caches
7. Return updated post

**`PostService.delete(db, id)`** (D6):
1. `postData.getById(db, id)` — fetch for cascade info
2. `postData.remove(db, id)` — **primary write**, throws on failure
3. `postData.refreshCategoryPostCount(db, post.category_id)` — secondary, catch + log
4. `postData.refreshAllTagPostCounts(db)` — secondary, catch + log
5. `postData.invalidatePostCaches()`

**`PostService.batchUpdate(db, ids, updates)`:**
1. `postData.batchUpdatePosts(db, ids, updates)` — pure bulk UPDATE
2. `postData.refreshAllCategoryPostCounts(db)` — broad refresh, batch can span categories
3. `postData.refreshAllTagPostCounts(db)` — same
4. `postData.invalidatePostCaches()` — covers list, count, and archives caches

**`PostService.getWithTags(db, id)`:**
1. `postData.getById(db, id)`
2. `postData.getPostTags(db, id)`
3. Return `PostWithTags`

**`PostService.getBySlugWithTags(db, slug, resolveFilter?)`:**
1. `postData.getBySlug(db, slug, resolveFilter)`
2. `postData.getPostTags(db, post.id)`
3. Return `PostWithTags`

### 6.2 MediaService (`src/services/media-service.ts`)

Orchestrates R2 storage + DB operations. Per D5, uses camelCase input.

**`MediaService.upload(db, file, postId?)`** — best-effort orchestration (D6):
1. Validate file (size, MIME type)
2. Generate R2 key
3. Upload to R2 — **primary write** (external storage is source of truth for the binary)
4. `mediaData.create(db, { filename, r2Key, mimeType, size, ... })` — **secondary** (DB record)
5. Return media with URL

If step 3 fails: throw, nothing was created.
If step 4 fails: R2 object exists but no DB record. Log error, throw — caller sees failure. The orphaned R2 object is cleaned up by a periodic R2 garbage collector (list R2 keys not in DB). This is the acceptable residue because R2 objects without DB records are invisible to the app (no URL path resolves to them).

**`MediaService.delete(db, id)`** — best-effort orchestration (D6):
1. `mediaData.getMedia(db, id)` — fetch to get `r2_key` (domain type, snake_case)
2. `mediaData.remove(db, id)` — **primary write** (DB record removal is the user-facing truth)
3. Delete from R2 — **secondary** (storage cleanup)

**Failure semantics:**

| Outcome | Behavior | Residue |
|---------|----------|---------|
| DB delete fails | Throw — nothing changed | None |
| DB delete succeeds, R2 delete fails | Log error, **return success** | Orphaned R2 object (invisible, GC-able) |
| All succeed | Return success | None |

**Why DB removal is primary:** The DB record is what makes the media visible in the app (URLs, media library, post associations). Once the DB record is gone, the media is effectively deleted from the user's perspective. An orphaned R2 object costs storage but is invisible — the same periodic R2 GC handles it.

**Implementation pattern:**
```ts
async function deleteMedia(db: Db, id: string): Promise<void> {
  const media = await mediaData.getMedia(db, id);
  if (!media) throw new Error("Media not found");

  // Primary: remove DB record (user-facing truth)
  await mediaData.remove(db, id);

  // Secondary: clean up R2 storage
  try {
    await r2.delete(media.r2_key);
  } catch (e) {
    log.error("R2 delete failed after DB removal", { id, r2Key: media.r2_key, error: e });
    // NOT re-thrown — DB record gone = media deleted from user perspective
    // Orphaned R2 object handled by periodic GC
  }
}
```

**`MediaService.upload` vs `delete` — opposite primary truth:**
- **Upload:** R2 is primary (the binary must exist first), DB is secondary.
- **Delete:** DB is primary (visibility removal is the user action), R2 is secondary.

This asymmetry is intentional: upload's failure mode (orphan R2) and delete's failure mode (orphan R2) both converge to the same residue — an invisible R2 object that the GC handles.

This moves R2 logic out of API route handlers into a testable service.

### 6.3 No Service for Tag/Category/Comment

These entities have no cross-entity orchestration. REST routes and MCP call the data layer directly. Tag/Category write wrappers invalidate their own cache inline after the base layer call.

---

## 7. MCP Framework Changes

### 7.1 What Changes

MCP entity configs (`src/lib/mcp/entities/*.ts`) are simplified. Business hooks are removed; MCP calls Services (for Post/Media) or data layer directly (for Tag/Category).

**Before (Post MCP entity):**
```ts
dataLayer: {
  create: createPost,     // raw data layer
  // ...
},
hooks: {
  afterGet: enrichWithTags,
  mapCreateInput: stripTagIds,
  afterCreate: setPostTags,          // ← business logic duplicated
  onCreateRollback: deletePost,      // ← rollback logic
  mapUpdateInput: stripTagIds,
  beforeUpdate: saveOldTagsThenSet,  // ← business logic duplicated
  onUpdateRollback: restoreOldTags,  // ← rollback logic
}
```

**After (Post MCP entity):**
```ts
dataLayer: {
  create: (db, input) => PostService.create(db, input),   // ← Service
  update: (db, id, input) => PostService.update(db, id, input),
  delete: (db, id) => PostService.delete(db, id),
  list: (db, opts) => postData.list(db, opts),      // reads go to data layer
  getById: (db, id) => postData.getById(db, id),
  getBySlug: (db, slug) => postData.getBySlug(db, slug),
},
hooks: {
  afterGet: async (ctx, post) => ({
    ...post,
    tags: await postData.getPostTags(ctx.db, post.id),
  }),
  // D5 boundary: MCP schema stays snake_case, Service expects camelCase
  mapCreateInput: (args) => mapMcpPostInput(args),
  mapUpdateInput: (args) => mapMcpPostInput(args),
  // NO afterCreate, beforeUpdate, rollback hooks — Service handles everything
}
```

**`mapMcpPostInput` — shared snake→camelCase mapper for MCP:**
```ts
function mapMcpPostInput(args: Record<string, unknown>) {
  const {
    new_slug,
    category_id,
    tag_ids,
    featured_image,
    comment_enabled,
    published_at,
    reference_url,
    reference_title,
    reference_description,
    reference_image,
    ...rest
  } = args;
  const mapped: Record<string, unknown> = { ...rest };
  if (new_slug !== undefined) mapped.slug = new_slug;
  if (category_id !== undefined) mapped.categoryId = category_id;
  if (tag_ids !== undefined) mapped.tagIds = tag_ids;
  if (featured_image !== undefined) mapped.featuredImage = featured_image;
  if (comment_enabled !== undefined) mapped.commentEnabled = comment_enabled;
  if (published_at !== undefined) mapped.publishedAt = published_at;
  if (reference_url !== undefined) mapped.referenceUrl = reference_url;
  if (reference_title !== undefined) mapped.referenceTitle = reference_title;
  if (reference_description !== undefined) mapped.referenceDescription = reference_description;
  if (reference_image !== undefined) mapped.referenceImage = reference_image;
  return mapped;
}
```

MCP schemas stay snake_case (`category_id`, `tag_ids`, `featured_image`, etc.) — the external tool interface is unchanged. The mapping happens once in hooks before the Service receives input.

### 7.2 MCP Framework Core Changes (`src/lib/mcp/framework/`)

**`handlers.ts`:** Remove rollback logic from `handleCreate` and `handleUpdate`.

- `handleCreate`: simply calls `dataLayer.create`, no try/catch around `afterCreate`, no `onCreateRollback`
- `handleUpdate`: simply calls `dataLayer.update`, no `beforeUpdate` rollback data capture, no `onUpdateRollback`

**`types.ts`:** Remove from `EntityHooks<T>`:
- `afterCreate`
- `onCreateRollback`
- `beforeUpdate`
- `onUpdateRollback`

Keep:
- `afterGet` — response enrichment (add tags to post)
- `mapCreateInput` / `mapUpdateInput` — field name mapping

**`register.ts`:** No changes (tool registration is driven by schemas, not hooks).

### 7.3 Tag/Category MCP Entities

**Tag MCP entity:** `dataLayer` imports point to new paths. `mapUpdateInput` stays (for `new_slug` → `slug` mapping). No business hooks existed before, nothing to remove. Tag schemas only use `name`/`slug` — both already camelCase, no boundary mapping change.

**Category MCP entity:** `dataLayer` imports point to new paths. `mapUpdateInput` stays (for `new_slug` → `slug`) **and gains** `sort_order` → `sortOrder` mapping. `mapCreateInput` added for the same `sort_order` → `sortOrder` mapping. MCP schema stays `sort_order` (external-facing, backward compatible) — the mapping happens in hooks, same pattern as `new_slug` → `slug`.

```ts
// Category MCP entity — after migration
hooks: {
  mapCreateInput: (args) => {
    const { sort_order, ...rest } = args;
    return sort_order !== undefined ? { ...rest, sortOrder: sort_order } : rest;
  },
  mapUpdateInput: (args) => {
    const { new_slug, sort_order, ...rest } = args;
    const mapped = { ...rest };
    if (new_slug !== undefined) mapped.slug = new_slug;
    if (sort_order !== undefined) mapped.sortOrder = sort_order;
    return mapped;
  },
},
```

---

## 8. Worker API Normalization

### 8.1 Deployment Strategy

**New Worker runs in parallel.** Steps:

1. Create new Worker project (e.g., `firefly-worker-v2`) with same D1 binding
2. Deploy to Cloudflare with a new route (e.g., `worker-v2.lizheng.me`)
3. Update `WORKER_URL` env var in Next.js to point to new Worker
4. Verify everything works
5. Decommission old Worker

Allows downtime during the switch — acceptable for a personal blog.

### 8.2 New Worker Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/health` | GET | Health check (version from package.json) |
| `/api/v1/query` | POST | Read-only SQL (same write guard) |
| `/api/v1/execute` | POST | Write SQL (single + batch) |

### 8.3 Changes from Current Worker

- Path prefix: `/api/v1/` instead of `/api/`
- Health endpoint renamed: `health` instead of `live`
- Version field: reads from define/env instead of hardcoded `"1.0.0"`
- Same auth model (Bearer token)
- Same CORS policy
- Same write guard regex

### 8.4 DB Client Update (`src/lib/db.ts`)

```ts
// Update paths
const queryUrl = `${workerUrl}/api/v1/query`;
const executeUrl = `${workerUrl}/api/v1/execute`;
```

---

## 9. REST API Route Migration

### 9.1 Consumer Inventory (91 total imports across all data modules)

| Module | Route Handlers | Server Components | MCP | Client (type-only) |
|--------|:-:|:-:|:-:|:-:|
| `@/data/posts` | 7 | 11 | 1 | 4 |
| `@/data/categories` | 4 | 6 | 1 | 0 |
| `@/data/tags` | 3 | 6 | 1 | 0 |
| `@/data/media` | 4 | 1 | 0 | 1 |
| `@/data/comments` | 0 | 1 | 0 | 0 |

### 9.2 Route Changes by Entity

**Tags** — Import path change + input type migration (D5):
- `src/app/api/tags/route.ts` → import from `@/data/entities/tag`
- `src/app/api/tags/[slug]/route.ts` → same
- Tag's current input types (`CreateTagInput`, `UpdateTagInput`) only have `name` and `slug` — both already match camelCase. **No boundary mapping needed** for tags.

**Categories** — Import path change + boundary mapping for `sort_order` → `sortOrder` (D5):
- `src/app/api/categories/route.ts` → import from `@/data/entities/category`
- `src/app/api/categories/[slug]/route.ts` → same
- `src/app/api/categories/reorder/route.ts` → same
- **Boundary mapping:** Current input types use `sort_order` (snake_case). New `CreateCategoryInput` / `UpdateCategoryInput` use `sortOrder` (camelCase per D5). Route handlers add a one-line mapping at the boundary: `{ ...body, sortOrder: body.sort_order }`. External API request shape stays `sort_order` for backward compatibility.

**Posts** — Import source changes from data layer to PostService + D5 boundary mapping:
- `POST /api/posts` → calls `PostService.create(db, input)` instead of `createPost` + `setPostTags`
- `PUT /api/posts/[slug]` → calls `PostService.update(db, id, input)` instead of `updatePost` + `setPostTags`
- `DELETE /api/posts/[slug]` → calls `PostService.delete(db, id)` instead of `deletePost`
- `GET /api/posts/[slug]` → calls `postData.getBySlug(db, slug, "published")` — direct data layer read
- `GET /api/posts` → calls `postData.list(db, options)` — direct data layer read
- `GET /api/admin/posts` → calls `postData.list(db, options)` — same data layer, no status filter
- `PATCH /api/admin/posts/batch` → calls `PostService.batchUpdate(db, ids, updates)`
- `POST /api/posts/[slug]/excerpt` → unchanged (AI service call)
- **D5 boundary mapping (route handlers):** External API keeps snake_case request body. Route handler maps to camelCase before calling PostService:
  ```
  category_id     → categoryId
  featured_image  → featuredImage
  comment_enabled → commentEnabled
  published_at    → publishedAt
  tag_ids         → tagIds
  reference_url   → referenceUrl
  reference_title → referenceTitle
  reference_description → referenceDescription
  reference_image → referenceImage
  ```
  A shared `mapPostInput(body)` utility does this once — both POST and PUT routes call it.

**Media** — Writes go through MediaService + D5 boundary mapping:
- `POST /api/media` → `MediaService.upload(db, file, postId)`
- `GET /api/media/[id]` → `mediaData.getMedia(db, id)` — direct data layer read
- `DELETE /api/media/[id]` → `MediaService.delete(db, id)`
- `GET /api/media` → `mediaData.list(db, options)` — direct data layer read
- `GET /api/media/years` → `mediaData.listMediaYears(db)` — direct data layer read
- `PATCH /api/media/associate` → `mediaData.associateMedia(db, ids, postId)`
- **D5 boundary mapping:** `post_id` → `postId` in upload and associate routes. Other media fields (`filename`, `size`, `width`, `height`) are already camelCase or no-case-difference.

**Server Components** — Import path changes:
- 11 post consumers → mix of `postData` (reads) and `PostService` (getWithTags)
- 6 category consumers → `@/data/entities/category`
- 6 tag consumers → `@/data/entities/tag`
- 1 comment consumer → `@/data/entities/comment`

**Type-only imports** (4 client components) → types re-exported from new locations.

---

## 10. Migration Plan

四个阶段，每个阶段独立交付、独立验证，前一阶段不影响线上行为。

### Stage 1: Core + Entities + Services + Tests

构建全部新代码，不删除旧代码，不修改任何现有 import。新旧并存，新代码通过 L1 单元测试验证。

| Step | Deliverable | Gate |
|------|-------------|------|
| 1.1 | `src/data/core/types.ts` | Compiles |
| 1.2 | `src/data/core/sql.ts` + `sql.test.ts` | 100% coverage |
| 1.3 | `src/data/core/timestamps.ts` + test | 100% coverage |
| 1.4 | `src/data/core/cache-manager.ts` + test | 100% coverage |
| 1.5 | `src/data/core/base-data-layer.ts` + test | 100% coverage |
| 1.6 | `src/data/core/test-utils.ts` | Used by all core tests |
| 1.7 | `src/data/entities/tag.ts` + `tag.test.ts` | 95%+ coverage |
| 1.8 | `src/data/entities/category.ts` + `category.test.ts` | 95%+ coverage |
| 1.9 | `src/data/entities/comment.ts` + `comment.test.ts` | 95%+ coverage |
| 1.10 | `src/data/entities/post.ts` + `post.test.ts` | 95%+ coverage |
| 1.11 | `src/data/entities/media.ts` + `media.test.ts` | 95%+ coverage |
| 1.12 | `src/services/post-service.ts` + `post-service.test.ts` | 95%+ coverage |
| 1.13 | `src/services/media-service.ts` + `media-service.test.ts` | 95%+ coverage |
| 1.14 | `src/data/settings.ts` — adopt `buildSetClauses` from `core/sql` | Existing settings tests pass |
| 1.15 | `src/data/ai-settings.ts` — adopt `buildSetClauses` from `core/sql` | Existing ai-settings tests pass |

**Stage 1 Gate:** `bun run test` 全部通过（新测试 + 旧测试）。线上零影响——旧代码和旧 import 全部保留，新代码只有测试在调用。

### Stage 2: New Worker + E2E

部署新 Worker，切换 DB client，用 E2E 验证数据库通路完好。

| Step | Deliverable | Gate |
|------|-------------|------|
| 2.1 | 新建 Worker 项目 with `/api/v1/health`, `/api/v1/query`, `/api/v1/execute` | Worker 部署成功 |
| 2.2 | 更新 `src/lib/db.ts` — 使用 `/api/v1/*` paths | Compiles |
| 2.3 | 更新 `WORKER_URL` 环境变量指向新 Worker | — |
| 2.4 | Run L2 API E2E 全量 | 全部通过 |
| 2.5 | Run L3 Browser E2E | 全部通过 |
| 2.6 | 旧 Worker 保留不动（回滚备用） | — |

**Stage 2 Gate:** L2 + L3 全量通过。新 Worker 跑通，旧 Worker 备用。此时线上已切换到新 Worker，但 Next.js 代码仍用旧 data layer。

### Stage 3: All Consumers 切换（REST + Server Components + MCP entities）

将**所有**旧 `src/data/*.ts` 的消费者切换到新模块，包括 REST routes、Server Components **和 MCP entity configs**。每个实体完成切换后立即删除旧文件，保证仓库始终可编译。

**关键原则：** 旧文件删除前，该文件的**全部** import（含 MCP）必须已切换。绝不允许出现"编译断裂"中间态。

| Step | Deliverable | Gate |
|------|-------------|------|
| **Tags (3 API + 6 SC + 1 MCP)** | | |
| 3.1 | Update `src/app/api/tags/route.ts` + `[slug]/route.ts` | Compiles |
| 3.2 | Update 6 server components (layout, tag pages, admin) | Compiles |
| 3.3 | Update `src/lib/mcp/entities/tag.ts` — imports → `@/data/entities/tag` | Compiles |
| 3.4 | Run L1 + L2 (tags + mcp) | Pass |
| 3.5 | Delete `src/data/tags.ts` + `tags.test.ts` | Clean, compiles |
| **Categories (4 API + 6 SC + 1 MCP)** | | |
| 3.6 | Update `categories/route.ts`, `[slug]/route.ts`, `reorder/route.ts` | Compiles |
| 3.7 | Update 6 server components | Compiles |
| 3.8 | Update `src/lib/mcp/entities/category.ts` — imports → `@/data/entities/category` | Compiles |
| 3.9 | Run L1 + L2 (categories + mcp) | Pass |
| 3.10 | Delete `src/data/categories.ts` + `categories.test.ts` | Clean, compiles |
| **Comments (1 SC, no MCP)** | | |
| 3.11 | Update 1 server component (`[year]/[month]/[slug]/page.tsx`) | Compiles |
| 3.12 | Delete `src/data/comments.ts` + `comments.test.ts` | Clean, compiles |
| **Posts (7 API + 11 SC + 4 CC + 1 MCP)** | | |
| 3.13 | Update `POST /api/posts` → `PostService.create` | — |
| 3.14 | Update `PUT /api/posts/[slug]` → `PostService.update` | — |
| 3.15 | Update `DELETE /api/posts/[slug]` → `PostService.delete` | — |
| 3.16 | Update `GET /api/posts`, `GET /api/posts/[slug]` → `postData` reads | — |
| 3.17 | Update `GET /api/admin/posts` → `postData.list` (read path, no Service) | — |
| 3.18 | Update `PATCH /api/admin/posts/batch` → `PostService.batchUpdate` | — |
| 3.19 | Update `POST /api/posts/[slug]/excerpt` → `postData` read | — |
| 3.20 | Update 11 server components (blog pages, admin pages, feed, sitemap, llms.txt) | — |
| 3.21 | Update 4 client components (type re-exports) | — |
| 3.22 | Update `src/lib/mcp/entities/post.ts` — writes → PostService, reads → postData, drop business hooks | Compiles |
| 3.23 | Run L1 + L2 + L3 全量 | All pass |
| 3.24 | Delete `src/data/posts.ts` + `posts.test.ts` | Clean, compiles |
| **Media (5 API routes in 4 files + 1 SC + 1 CC, no MCP entity)** | | |
| 3.25 | Update `POST /api/media` → `MediaService.upload` | — |
| 3.26 | Update `GET /api/media/[id]` → `mediaData.getMedia`, `DELETE /api/media/[id]` → `MediaService.delete` | — |
| 3.27 | Update `GET /api/media`, `GET /api/media/years`, `PATCH /api/media/associate` → `mediaData` | — |
| 3.28 | Update 1 server component + 1 client component | — |
| 3.29 | Run L1 + L2 | Pass |
| 3.30 | Delete `src/data/media.ts` + `media.test.ts` | Clean, compiles |

**Stage 3 Gate:** 全部旧 data layer entity 文件已删除。MCP entity imports 已切换。L1 + L2 + L3 全量通过。仓库在每个子步骤后都可编译。

### Stage 4: MCP Framework 简化 + 最终清理

Stage 3 已完成 MCP entity config 的 import 切换。Stage 4 专注于 MCP **framework** 层的简化（移除 rollback 机制）和全局清理。

| Step | Deliverable | Gate |
|------|-------------|------|
| 4.1 | Remove rollback hooks from `src/lib/mcp/framework/types.ts` | Compiles |
| 4.2 | Simplify `src/lib/mcp/framework/handlers.ts` — remove rollback logic | Compiles |
| 4.3 | Update MCP entity tests (reflect removed hooks) | Pass |
| 4.4 | Update MCP framework tests | Pass |
| 4.5 | Run L1 + L2 (mcp.test.ts) 全量 | All pass |
| 4.6 | Cleanup: migrate `createMockDb` in remaining test files to `core/test-utils` | — |
| 4.7 | Full coverage report: core 100%, entities 95%+, services 95%+ | Met |
| 4.8 | Full L1 + L2 + L3 | All pass |
| 4.9 | Decommission old Worker | — |
| 4.10 | Update docs/README.md, CLAUDE.md | — |

**Stage 4 Gate:** MCP framework rollback 机制已移除。全部测试通过。旧 Worker 下线。文档更新。

---

## 11. Test Strategy

### 11.1 Coverage Targets

| Module | Target |
|--------|--------|
| `src/data/core/sql.ts` | 100% |
| `src/data/core/base-data-layer.ts` | 100% |
| `src/data/core/cache-manager.ts` | 100% |
| `src/data/core/timestamps.ts` | 100% |
| `src/data/entities/tag.ts` | 95%+ |
| `src/data/entities/category.ts` | 95%+ |
| `src/data/entities/post.ts` | 95%+ |
| `src/data/entities/media.ts` | 95%+ |
| `src/data/entities/comment.ts` | 95%+ |
| `src/services/post-service.ts` | 95%+ |
| `src/services/media-service.ts` | 95%+ |

### 11.2 Key Test Scenarios

**Core sql.ts:**
- `buildSetClauses`: empty input, single field, multiple fields, null on nullable field, null on non-nullable field (passes through), undefined skipped, field ordering
- `buildInsert`: single column, many columns, correct placeholder count
- `buildWhere`: no conditions, single, multiple, param merging
- `buildPagination`: page 1 offset 0, page N correct offset
- `buildOrderBy`: valid column, invalid column throws

**Core base-data-layer.ts:**
- `list` with `listMode: "all"`: returns `T[]`, no pagination params needed, uses cache if defined
- `list` with `listMode: "paginated"`: delegates to `customList` when defined; uses default pagination query otherwise
- `list` with `listMode: "all"` + cache: returns cached array on cache hit, queries on miss
- `getById`: uses viewQuery when defined; falls back to `SELECT * FROM table`
- `getById` with viewQuery + tableAlias: WHERE uses `{alias}.id = ?` (not bare `id`)
- `getBySlug`: appends WHERE slug = ?; applies resolveFilter when provided
- `getBySlug` with viewQuery + tableAlias: WHERE uses `{alias}.slug = ?`
- `create`: calls newId + nowEpoch, runs beforeCreate hook (input enrichment), inserts, fetches back
- `update`: fetches existing, runs beforeUpdate (input enrichment), builds SET clauses, no-op on empty, fetches back
- `remove`: deletes, returns boolean

**PostService:**
- `create`: data layer create + setPostTags + refreshCategoryCount
- `create` without tag_ids: no setPostTags call
- `create` with setPostTags failure: returns post (D6), error logged, tags absent
- `create` with refreshCounts failure: returns post (D6), counts stale
- `update` with category change: refreshes old AND new category
- `update` with status change: refreshes all tag counts + archives
- `update` with neither changed: no count refresh
- `delete`: refreshes category + tags + archives
- `batchUpdate`: calls refreshAllCategoryPostCounts + refreshAllTagPostCounts

**MCP entity (post):**
- `afterGet` enriches with tags
- `dataLayer.create` calls PostService (not raw data layer)
- `mapCreateInput` / `mapUpdateInput` maps all snake_case MCP fields to camelCase
- No rollback hooks exist

**MediaService:**
- `upload`: R2 upload + DB create in sequence
- `upload` with DB create failure after R2 success: throws, orphan R2 (GC-able)
- `delete`: DB remove + R2 delete in sequence
- `delete` with R2 failure after DB remove: returns success (D6), orphan R2 logged

### 11.3 L2/L3 as Integration Safety Net

All existing E2E tests run unchanged. They verify external API behavior hasn't changed despite the internal rewrite. No new E2E tests needed — this is a refactoring, not a feature.

---

## 12. Atomic Commits

| Stage | Commits |
|-------|---------|
| **S1** | `feat(data): add core types for entity data layer` |
| S1 | `feat(data): add SQL composition utilities with 100% coverage` |
| S1 | `feat(data): add timestamps, cache-manager, and shared test-utils` |
| S1 | `feat(data): add BaseDataLayer with viewQuery support` |
| S1 | `feat(data): add Tag entity with 95%+ coverage` |
| S1 | `feat(data): add Category entity with 95%+ coverage` |
| S1 | `feat(data): add Comment entity (read-only)` |
| S1 | `feat(data): add Post entity with viewQuery, customList, and data hooks` |
| S1 | `feat(data): add Media entity` |
| S1 | `feat(services): add PostService for cross-entity post orchestration` |
| S1 | `feat(services): add MediaService for R2+DB orchestration` |
| S1 | `refactor(data): adopt core SQL utilities in settings + ai-settings` |
| **S2** | `feat(worker): deploy v2 Worker with /api/v1/* paths` |
| S2 | `refactor(db): switch to v1 Worker API paths` |
| **S3** | `refactor: switch Tag consumers (routes + SC + MCP) to new entity module` |
| S3 | `chore: remove legacy src/data/tags.ts` |
| S3 | `refactor: switch Category consumers (routes + SC + MCP) to new entity module` |
| S3 | `chore: remove legacy src/data/categories.ts` |
| S3 | `refactor: switch Comment consumer to new entity module` |
| S3 | `chore: remove legacy src/data/comments.ts` |
| S3 | `refactor: switch Post consumers (routes + SC + MCP) to PostService + postData` |
| S3 | `chore: remove legacy src/data/posts.ts` |
| S3 | `refactor: switch Media consumers (routes + SC) to MediaService + mediaData` |
| S3 | `chore: remove legacy src/data/media.ts` |
| **S4** | `refactor(mcp): remove rollback hooks from MCP framework` |
| S4 | `chore: cleanup, coverage hardening, docs update` |

---

## 13. File Manifest

### New Files

| File | Purpose | Est. Lines |
|------|---------|-----------|
| `src/data/core/types.ts` | Shared interfaces | ~100 |
| `src/data/core/sql.ts` | SQL utilities | ~90 |
| `src/data/core/sql.test.ts` | 100% coverage | ~200 |
| `src/data/core/base-data-layer.ts` | Generic CRUD with viewQuery | ~200 |
| `src/data/core/base-data-layer.test.ts` | 100% coverage | ~350 |
| `src/data/core/cache-manager.ts` | Entity cache | ~40 |
| `src/data/core/cache-manager.test.ts` | Tests | ~80 |
| `src/data/core/timestamps.ts` | nowEpoch, newId | ~10 |
| `src/data/core/timestamps.test.ts` | Tests | ~30 |
| `src/data/core/test-utils.ts` | Shared createMockDb | ~25 |
| `src/data/entities/tag.ts` | Tag config + CRUD | ~60 |
| `src/data/entities/tag.test.ts` | Tests | ~120 |
| `src/data/entities/category.ts` | Category config + extras | ~100 |
| `src/data/entities/category.test.ts` | Tests | ~180 |
| `src/data/entities/post.ts` | Post config + viewQuery + hooks + extras | ~400 |
| `src/data/entities/post.test.ts` | Tests | ~500 |
| `src/data/entities/media.ts` | Media config + extras | ~150 |
| `src/data/entities/media.test.ts` | Tests | ~200 |
| `src/data/entities/comment.ts` | Comment read-only | ~35 |
| `src/data/entities/comment.test.ts` | Tests | ~80 |
| `src/services/post-service.ts` | Post write orchestration | ~200 |
| `src/services/post-service.test.ts` | Tests | ~350 |
| `src/services/media-service.ts` | Media R2+DB orchestration | ~80 |
| `src/services/media-service.test.ts` | Tests | ~150 |

### Deleted Files

| File | Replaced By |
|------|-------------|
| `src/data/tags.ts` + test | `entities/tag.ts` |
| `src/data/categories.ts` + test | `entities/category.ts` |
| `src/data/posts.ts` + test | `entities/post.ts` + `services/post-service.ts` |
| `src/data/media.ts` + test | `entities/media.ts` + `services/media-service.ts` |
| `src/data/comments.ts` + test | `entities/comment.ts` |

### Modified Files (40+)

**API Routes (14 files):** All tag/category/post/media route handlers — import path changes + PostService/MediaService adoption.

**MCP (5 files):** `entities/tag.ts`, `entities/category.ts`, `entities/post.ts` — import paths + hook simplification (Stage 3, per-entity). `framework/handlers.ts` + `framework/types.ts` — rollback removal (Stage 4).

**Server Components (20+ files):** Import path changes for all `@/data/*` consumers.

**Client Components (4 files):** Type re-export path changes.

**Infrastructure (2 files):** `src/lib/db.ts` (v1 paths), `worker/src/index.ts` (new Worker).

### Unchanged

| Category | Files |
|----------|-------|
| Settings / AI-Settings | `src/data/settings.ts`, `src/data/ai-settings.ts` (Phase 7 only adopts `buildSetClauses`) |
| Analytics | `src/data/analytics.ts` — different pattern, not entity CRUD |
| Backup | `src/data/backup.ts`, `backup-export.ts` |
| MCP Auth | `src/data/mcp-*.ts` |
| Redirects | `src/data/redirects.ts` |
| All E2E tests | External behavior unchanged |
| MCP framework register/resolve/projection/response | Zero changes |

---

## Appendix: Impact Summary

| Metric | Before | After |
|--------|--------|-------|
| Data layer entity code | ~1,454 lines (5 files) | ~745 lines (5 entity files) + ~440 lines (core) |
| Service layer | 0 | ~280 lines (PostService + MediaService) |
| Copy-pasted dynamic UPDATE | 5 copies | **1 implementation** |
| Tag association code paths | 2 (REST + MCP) | **1 (PostService)** |
| MCP business hooks | 6 (afterCreate, onCreateRollback, beforeUpdate, onUpdateRollback × Post) | **0** |
| Post read queries | Manual SQL per call site | **viewQuery in config, single definition** |
| Core test coverage | ~90% mixed | **100%** |
| Entity/Service test coverage | ~90% mixed | **95%+** |
| API response shape changes | — | **0** (domain types stay snake_case, D5) |
| Database schema changes | — | **0** |
| Domain type (`src/models/types.ts`) changes | — | **0** (all interfaces stay snake_case) |
