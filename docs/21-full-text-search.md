# 21 — Full-Text Search

## Overview

Add performant full-text search to the blog, replacing the current `LIKE %query%` filter with D1/SQLite FTS5 and exposing a modern search UI on the frontend.

### Current State

- `listPosts()` has a `query` option that does `4× LIKE %query%` on `title`, `slug`, `content`, `excerpt` — full table scan, no ranking
- Both public (`GET /api/posts?q=`) and admin (`GET /api/admin/posts?q=`) routes pass this through
- MCP `post_list` tool also passes `query` to `listPosts()`
- **No frontend search UI exists** — zero search bar, zero search page

### Design Goals

1. **Performance** — FTS5 index instead of LIKE scans; sub-50ms queries at ~1000 posts
2. **Relevance** — Title matches rank higher than content matches (BM25 weighting)
3. **Zero extra infrastructure** — D1 natively supports FTS5; no external search service
4. **Bilingual** — Chinese + English via `Intl.Segmenter` application-layer word segmentation
5. **Minimal API surface change** — Upgrade the existing `query` filter path, add snippet support
6. **Clean UX** — Search bar in sidebar, dedicated `/search` results page with highlighted excerpts

---

## Architecture

### Key Decision: Application-Layer Segmentation + FTS5

D1's built-in tokenizers (`unicode61`, `porter`, `ascii`) **do not support CJK text** — verified on D1 test environment (2026-03-29). The `unicode61` tokenizer treats consecutive Chinese characters as a single token, making substring search impossible. The `trigram` tokenizer works for ≥3 chars but fails on common 2-character Chinese words ("搜索", "中文") and has no BM25 ranking.

**Solution**: Use `Intl.Segmenter` (V8 built-in, zero-dependency, available in Cloudflare Workers) to pre-segment text at the application layer before writing to FTS5. The FTS5 table stores **segmented tokens** while the main `posts` table stores **original text**.

```
┌──────────────────────────────────────────────────────────────┐
│                       posts table                            │
│ id (TEXT PK) │ title (原文) │ content (原文) │ excerpt (原文) │
└──────┬───────────────────────────────────────────────────────┘
       │ rowid
┌──────▼───────────────────────────────────────────────────────┐
│                    posts_fts (FTS5)                           │
│ rowid │ title (分词后) │ content (分词后) │ excerpt (分词后)  │
└──────────────────────────────────────────────────────────────┘

写入: Worker 端 Intl.Segmenter 分词 → INSERT posts_fts
查询: Worker 端 Intl.Segmenter 分词 → FTS5 MATCH → JOIN posts
```

### Why Not SQL Triggers?

Triggers can only execute SQL, but segmentation requires JavaScript runtime (`Intl.Segmenter`). Therefore FTS sync **must** happen at the application layer (Worker), not via database triggers.

### Data Flow

```
写入流程:
  PostService.create/update()
  → Worker POST /api/v1/fts-sync  (带原文)
  → Worker 内 Intl.Segmenter 分词
  → INSERT/UPDATE posts_fts (分词后文本)

查询流程:
  User types "边缘计算"
  → GET /search?q=边缘计算  (Next.js Server Component)
  → Worker GET /api/v1/fts-search?q=边缘计算
  → Worker 内 Intl.Segmenter("边缘计算") → "边缘 计算"
  → FTS5 MATCH '"边缘" "计算"'
  → JOIN posts for full row data + snippet
  → Return results with BM25 ranking
```

---

## Segmentation Layer

### `Intl.Segmenter` — Zero-Dependency CJK Word Segmentation

Cloudflare Workers run on V8 which includes ICU dictionaries. `Intl.Segmenter` with Chinese locale produces proper word-level tokens:

```typescript
const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });

function segmentText(text: string): string {
  return [...segmenter.segment(text)]
    .filter(s => s.isWordLike)
    .map(s => s.segment.toLowerCase())
    .join(" ");
}

// Examples:
// "使用Cloudflare构建边缘计算应用" → "使用 cloudflare 构建 边缘 计算 应用"
// "React 和 Vue 的性能对比分析"    → "react 和 vue 的 性能 对比 分析"
// "中文全文搜索测试"              → "中文 全文 搜索 测试"
```

Key properties:
- **Mixed CJK + Latin**: English words preserved as whole tokens, Chinese split into words
- **`isWordLike` filter**: Strips punctuation and whitespace automatically
- **Lowercase**: Normalize for case-insensitive matching
- **Consistent runtime**: Both write and query segmentation happen in the same Worker V8 instance, guaranteeing identical tokenization

---

## Database Layer

### Migration: `013-fts5-search.sql`

```sql
-- Create FTS5 virtual table (external content mode, stores only inverted index)
-- Content is segmented at application layer before INSERT
CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
  title,
  content,
  excerpt,
  content='',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);
```

Note: `unicode61` is still the FTS5 tokenizer — it works perfectly for **pre-segmented** text because the input is already space-delimited tokens. The application layer handles CJK segmentation; FTS5 just needs to split on spaces.

**No triggers** — sync is handled by Worker endpoints.

### Existing Data Migration

Existing posts must be bulk-segmented and indexed via a Worker endpoint (see Worker Layer below). This runs once after migration, and is also available as a "rebuild index" admin action.

### FTS5 Query Syntax

| User input | Segmented | FTS5 query | Rationale |
|---|---|---|---|
| `cloudflare workers` | `cloudflare workers` | `"cloudflare" "workers"` | AND all terms |
| `边缘计算` | `边缘 计算` | `"边缘" "计算"` | Segmented then AND |
| `"exact phrase"` | (pass through) | `"exact phrase"` | Quoted phrases preserved |
| `cloud*` | `cloud*` | `cloud*` | Prefix match preserved |

---

## Worker Layer

### New Endpoints

Add three endpoints to the Worker (`worker/src/index.ts`):

#### 1. `POST /api/v1/fts-sync` — Sync single post to FTS

Called by PostService after create/update/delete.

```typescript
// Request body:
{ action: "upsert" | "delete", postId: string, title?: string, content?: string, excerpt?: string }

// Worker logic:
// 1. If delete: remove from posts_fts by rowid
// 2. If upsert:
//    a. Segment title, content, excerpt with Intl.Segmenter
//    b. Get posts.rowid from D1
//    c. DELETE old entry from posts_fts (if exists)
//    d. INSERT segmented text into posts_fts
```

#### 2. `POST /api/v1/fts-rebuild` — Rebuild entire FTS index

Admin-only. Used for initial migration and index recovery.

```typescript
// Worker logic:
// 1. DELETE FROM posts_fts (clear index)
// 2. SELECT rowid, title, content, excerpt FROM posts
// 3. For each post: segment with Intl.Segmenter
// 4. Batch INSERT into posts_fts (D1.batch() is atomic)
```

For ~500 posts, this takes < 2 seconds.

#### 3. `GET /api/v1/fts-search` — Execute FTS5 search query

Called by Next.js `searchPosts()` data layer function.

```typescript
// Query params: q (required), status, page, pageSize, snippets
// Worker logic:
// 1. Segment query with Intl.Segmenter
// 2. Build FTS5 MATCH expression
// 3. Execute search SQL with BM25 ranking
// 4. Return results + optional snippets
```

Search SQL:

```sql
SELECT p.*, c.name AS category_name, c.slug AS category_slug,
       snippet(posts_fts, 1, '<mark>', '</mark>', '…', 40) AS search_snippet
FROM posts_fts
JOIN posts p ON p.rowid = posts_fts.rowid
LEFT JOIN categories c ON p.category_id = c.id
WHERE posts_fts MATCH ?
  AND p.status = ?
ORDER BY bm25(posts_fts, 10.0, 1.0, 5.0)
LIMIT ? OFFSET ?
```

**BM25 weights**: `(10.0, 1.0, 5.0)` = title × 10, content × 1, excerpt × 5 — title matches are most relevant.

**snippet() parameters**: Column 1 (content), `<mark>` / `</mark>` markers, `…` ellipsis, 40 tokens context.

---

## Data Layer Changes

### New function: `searchPosts()`

File: `src/data/entities/post.ts`

```typescript
interface SearchPostsOptions {
  query: string;           // required, min 1 char
  status?: PostStatus;     // default: 'published'
  page?: number;           // default: 1
  pageSize?: number;       // default: 20
}

interface SearchResult {
  posts: PostWithCategory[];
  snippets: Map<string, string>;  // post.id → highlighted snippet
  total: number;
  page: number;
  pageSize: number;
}
```

Implementation calls `GET /api/v1/fts-search` on the Worker (segmentation + FTS5 query happen server-side in the Worker).

### Upgrade existing `listPosts()` query filter

Replace the 4× LIKE block in `listPosts()`:

```typescript
// Before:
if (query) {
  conditions.push("(p.title LIKE ? OR p.slug LIKE ? OR p.content LIKE ? OR p.excerpt LIKE ?)");
  const like = `%${query}%`;
  params.push(like, like, like, like);
}

// After:
if (query) {
  // Delegate to FTS search via Worker endpoint
  // The Worker handles segmentation + FTS5 MATCH
  conditions.push("p.rowid IN (SELECT rowid FROM posts_fts WHERE posts_fts MATCH ?)");
  params.push(segmentedQuery);  // pre-segmented by caller
}
```

**Note**: For `listPosts()`, the query still goes through the Worker proxy as raw SQL. The segmentation for the `query` parameter needs to happen before building the SQL. Two options:
- **Option A**: `listPosts()` calls a Worker segmentation endpoint first, then builds SQL — extra round-trip
- **Option B**: `listPosts()` falls back to LIKE for now; only the dedicated `/search` uses FTS5

**Recommendation**: Option B for simplicity. The existing `listPosts()` LIKE filter is used by admin and MCP, where latency is less critical. The new `searchPosts()` is the primary FTS5 path for the frontend.

---

## API Layer

### Enhanced endpoint: `GET /api/posts?q=...&snippets=1`

No new Next.js routes needed for the API. The existing `GET /api/posts` route delegates search queries to the Worker's `GET /api/v1/fts-search` when `q` is provided and `snippets=1` is requested.

Response shape:

```json
{
  "data": [/* PostWithCategory[] */],
  "snippets": {
    "01JA...": "...Cloudflare <mark>Workers</mark> provides..."
  },
  "pagination": { "page": 1, "pageSize": 10, "total": 42, "totalPages": 5 }
}
```

When `snippets` is not requested, the response shape is unchanged — backward compatible.

---

## PostService Integration

### FTS Sync on Write

`PostService.create()` and `PostService.update()` call `POST /api/v1/fts-sync` after successful write as a **best-effort secondary effect** (D6 contract: primary write throws, FTS sync logs on failure).

```typescript
// In PostService.create():
const post = await createPost(this.db, input);
// Best-effort FTS sync
try {
  await ftsSync({ action: "upsert", postId: post.id, title: input.title, content: input.content, excerpt: input.excerpt });
} catch (e) {
  console.error("[FTS] sync failed for post", post.id, e);
}
return post;
```

`PostService.delete()` sends `{ action: "delete", postId }`.

If FTS sync fails silently, the index becomes stale for that post. The admin `fts-rebuild` endpoint is the recovery mechanism.

---

## Frontend

### 1. Search Bar in Sidebar

Position: below social links, above categories section.

```
┌─────────────────────────┐
│      Site Name          │
│      Tagline            │
│   [social icons row]    │
│                         │
│   [ Search...        🔍]│  ← NEW
│                         │
│   📁 Categories         │
│   🏷️ Tags              │
│   📦 Archives           │
└─────────────────────────┘
```

Component: `SearchInput` (client component)

- Renders a `<form>` with `action="/search"` and `method="get"` — works without JS
- `<input name="q" type="search" />` with placeholder text
- On submit: navigates to `/search?q=...`
- **No debounced instant search** — simple form submission to keep it lightweight
- Keyboard shortcut: `/` focuses search input (common blog convention)

### 2. Search Results Page

Route: `src/app/(blog)/search/page.tsx` (Server Component)

- Reads `searchParams.q` and `searchParams.page`
- Calls `searchPosts(db, { query, page, pageSize })`
- Renders result count header: "42 results for 'cloudflare'"
- Renders `PostCard` list (reuses existing component)
- For each post, shows the FTS5 snippet (with `<mark>` highlighting) instead of the regular excerpt
- Renders `Pagination` component
- Empty state: friendly "no results" message with suggestions
- SEO: `noindex` on search results page (`robots: { index: false }`)

### 3. Styles

- `.blog-search` — form wrapper with subtle border, matching sidebar section spacing
- `.blog-search input` — full-width, matching font/color with blog theme
- `mark` in search results — `background: var(--blog-accent) / 0.2; padding: 0.1em 0.2em; border-radius: 2px`

---

## Atomic Commits

| # | Commit | Files |
|---|--------|-------|
| 1 | `feat(db): add FTS5 search migration` | `scripts/migrations/013-fts5-search.sql` |
| 2 | `feat(worker): add FTS segmentation and search endpoints` | `worker/src/index.ts`, `worker/src/fts.ts` |
| 3 | `feat(data): add searchPosts() function` | `src/data/entities/post.ts` |
| 4 | `feat(service): integrate FTS sync into PostService` | `src/services/post-service.ts` |
| 5 | `test(data): add searchPosts and FTS sync unit tests` | `src/data/entities/__tests__/post.test.ts` |
| 6 | `feat(api): add snippet support to GET /api/posts` | `src/app/api/posts/route.ts` |
| 7 | `feat(ui): add SearchInput sidebar component` | `src/components/blog/search-input.tsx`, `src/components/blog/blog-sidebar.tsx`, CSS |
| 8 | `feat(ui): add /search results page` | `src/app/(blog)/search/page.tsx` |
| 9 | `test(e2e): add search API E2E tests` | `e2e/api/search.test.ts` |
| 10 | `chore: run fts-rebuild on production` | One-time migration step (manual) |

---

## Testing Strategy

| Layer | What | How |
|---|---|---|
| **L1 UT** | `segmentText()` — CJK, English, mixed, empty, special chars | Pure function tests (Node 18+ has `Intl.Segmenter`) |
| **L1 UT** | `searchPosts()` — query building, pagination, snippet extraction | Mock DB calls |
| **L1 UT** | `sanitizeFtsQuery()` — escape FTS5 special chars, quoted phrases | Pure function tests |
| **L1 UT** | `SearchInput` component — renders form, input with name="q" | React Testing Library |
| **L2 Lint** | All new files pass ESLint strict mode | Pre-commit hook |
| **L3 E2E** | `GET /api/v1/fts-search?q=cloudflare` — verify results, snippet content, BM25 ranking | API E2E against real D1 |
| **L3 E2E** | `GET /api/v1/fts-search?q=边缘计算` — verify Chinese search works | API E2E against real D1 |
| **L3 E2E** | `GET /api/v1/fts-search?q=nonexistent` — empty results, correct shape | API E2E |
| **L3 E2E** | `POST /api/v1/fts-sync` — verify index updates after post create/update/delete | API E2E |

---

## Performance Considerations

| Concern | Mitigation |
|---|---|
| FTS5 index size | External content mode stores only the inverted index. Segmented text produces more tokens but index is still < 5 MB for ~1000 posts. |
| Query latency | FTS5 MATCH is O(log n) vs O(n) for LIKE. Sub-10ms for typical queries. |
| Segmentation overhead | `Intl.Segmenter` runs in-process on the V8 runtime — microseconds per query. No external service calls. |
| Extra round-trip | Search queries go Next.js → Worker (segmentation + FTS5) → D1. This is the same hop count as existing queries (Next.js → Worker proxy → D1). No additional latency. |
| D1 edge reads | FTS5 queries are read-only and benefit from D1's global read replicas. |
| FTS rebuild | ~500 posts × segmentation + batch INSERT: < 2 seconds. D1.batch() is atomic. |
| Index staleness | Best-effort sync on write; fts-rebuild as recovery. Acceptable for a personal blog. |

---

## D1 Compatibility — Verified

Tested on D1 remote (test env `lizhengme-db-test`) on 2026-03-29:

| Feature | Result |
|---|---|
| `CREATE VIRTUAL TABLE ... USING fts5(...)` | ✅ Works |
| `INSERT INTO posts_fts` | ✅ Works |
| `SELECT ... WHERE MATCH 'english'` | ✅ Works |
| `unicode61` tokenizer on pre-segmented Chinese | ✅ Works (space-delimited tokens) |
| `unicode61` tokenizer on raw Chinese (no spaces) | ❌ Fails — entire string = 1 token |
| `trigram` tokenizer | ✅ Works for ≥3 chars, ❌ fails for 2-char Chinese words |
| `bm25()` ranking | ✅ Works |
| `snippet()` function | ✅ Works |

This confirms the application-layer segmentation approach is necessary and sufficient.

---

## Open Questions

1. **Admin search**: The existing `listPosts()` LIKE filter continues to work for admin and MCP. A future enhancement could route admin search through FTS5 too, but this is out of scope.

2. **Search scope expansion**: Should we search tags and categories too? Deferred — can be added later by expanding the FTS5 table or adding a secondary lookup.

3. **Stale index recovery**: The `fts-rebuild` endpoint is manual. A future cron job or health check could detect and auto-repair staleness, but for a personal blog this is overkill.
