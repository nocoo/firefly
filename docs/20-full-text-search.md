# 20 — Full-Text Search

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
5. **Minimal API surface change** — Dedicated search endpoint, existing API untouched
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
│                    posts_fts (FTS5, stored)                   │
│ rowid │ title (分词后) │ content (分词后) │ excerpt (分词后)  │
└──────────────────────────────────────────────────────────────┘

写入: Worker 端 Intl.Segmenter 分词 → INSERT posts_fts (分词后文本存入 FTS 内部)
删除: PostService 删前查 rowid → fts-sync 直接按 rowid 删 FTS 行（不依赖主表）
查询: Worker 端 Intl.Segmenter 分词 → FTS5 MATCH → snippet() 从 FTS 内部读分词文本生成高亮 → JOIN posts 取原文字段
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

删除流程:
  PostService.delete()
  → 删前查 posts.rowid（主表还在）
  → 主删除 deletePost()
  → Worker POST /api/v1/fts-sync  { action: "delete", rowid }
  → DELETE FROM posts_fts WHERE rowid = ?（不依赖主表）

查询流程:
  User types "边缘计算"
  → GET /search?q=边缘计算  (Next.js Server Component)
  → Worker POST /api/v1/fts-search  { query: "边缘计算", status: "published" }
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
-- Create FTS5 virtual table (default stored mode — stores segmented text internally)
-- snippet()/highlight() require stored content; contentless (content='') returns empty.
-- Content is segmented at application layer before INSERT.
CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
  title,
  content,
  excerpt,
  tokenize='unicode61 remove_diacritics 2'
);
```

**Why default stored mode instead of `content=''` or `content='posts'`**:

- `content=''` (contentless): FTS5 does not store original text → `snippet()` and `highlight()` return empty strings. Verified on local sqlite3.
- `content='posts'` (external content): FTS5 reads from `posts` table for snippet generation, but `posts` stores **original unsegmented text** while the FTS index contains **segmented tokens**. The token positions don't match the source text, so `snippet()` fails to insert `<mark>` tags correctly.
- **Default stored mode** (no `content=` parameter): FTS5 stores the segmented text internally. `snippet()` reads from this internal storage where tokens match positions exactly → highlights work correctly. Trade-off is higher storage (~2× index size), but for ~1000 posts this is negligible (< 10 MB vs < 5 MB).

Note: `unicode61` is still the FTS5 tokenizer — it works perfectly for **pre-segmented** text because the input is already space-delimited tokens. The application layer handles CJK segmentation; FTS5 just needs to split on spaces.

**No triggers** — sync is handled by Worker endpoints.

**Caveat**: Since snippet() returns **segmented** text (with spaces between CJK words), the frontend snippet renderer should collapse consecutive spaces and trim inter-word spaces for CJK characters for a clean display. This is a lightweight post-processing step in the search results renderer.

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
// For upsert:
{ action: "upsert", postId: string, title: string, content: string, excerpt?: string }
// For delete (rowid obtained BEFORE main table deletion):
{ action: "delete", rowid: number }

// Worker logic:
// 1. If delete: DELETE FROM posts_fts WHERE rowid = ?  (直接按 rowid 删，不查主表)
// 2. If upsert:
//    a. Segment title, content, excerpt with Intl.Segmenter
//    b. Get posts.rowid from D1
//    c. DELETE old entry from posts_fts (if exists)
//    d. INSERT segmented text into posts_fts
```

**Why delete carries `rowid` instead of `postId`**: PostService follows "primary throws, secondary best-effort" (D6). On delete, the main `posts` row is removed first, so by the time fts-sync fires, `posts.rowid` can no longer be looked up by `postId`. The caller must capture `rowid` **before** the primary deletion and pass it directly.

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

#### 3. `POST /api/v1/fts-search` — Execute FTS5 search query

Called by Next.js `searchPosts()` data layer function. Uses POST to match the existing Worker transport contract (all `/api/v1/*` routes are POST-only).

```typescript
// Request body: { query: string, status?: string, page?: number, pageSize?: number }
// Worker logic:
// 1. Segment query with Intl.Segmenter
// 2. Build FTS5 MATCH expression
// 3. Execute search SQL with BM25 ranking
// 4. Return results + snippets
```

Search SQL:

```sql
SELECT p.*, c.name AS category_name, c.slug AS category_slug,
       snippet(posts_fts, -1, '<mark>', '</mark>', '…', 40) AS search_snippet
FROM posts_fts
JOIN posts p ON p.rowid = posts_fts.rowid
LEFT JOIN categories c ON p.category_id = c.id
WHERE posts_fts MATCH ?
  AND p.status = ?
ORDER BY bm25(posts_fts, 10.0, 1.0, 5.0), p.published_at DESC, p.rowid DESC
LIMIT ? OFFSET ?
```

**BM25 weights**: `(10.0, 1.0, 5.0)` = title × 10, content × 1, excerpt × 5 — title matches are most relevant.

**Stable pagination**: `p.published_at DESC, p.rowid DESC` as tie-breaker when BM25 scores are equal. Without this, `LIMIT/OFFSET` across pages can produce duplicates or missed rows.

**snippet() parameters**: Column `-1` (auto-select best matching column), `<mark>` / `</mark>` markers, `…` ellipsis, 40 tokens context. Using `-1` instead of a fixed column index ensures that title-only matches show a highlighted title snippet rather than an unhighlighted content excerpt.

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
  snippets: Record<string, string>;  // post.id → highlighted snippet HTML
  total: number;
  page: number;
  pageSize: number;
}
```

Implementation calls `POST /api/v1/fts-search` on the Worker via `db.call()` (see Db Extension below).

### Existing `listPosts()` — unchanged

The existing `listPosts()` query filter (`4× LIKE %query%`) is **kept as-is**. It serves admin and MCP where latency is less critical and FTS index availability cannot be assumed. Only the dedicated `searchPosts()` path uses FTS5.

### Db Extension: `call()` method

File: `src/lib/db.ts`

The current `Db` interface only exposes SQL methods (`query`, `firstOrNull`, `execute`, `batch`). `searchPosts()` needs to call the custom Worker endpoint `POST /api/v1/fts-search`, which is not a raw SQL operation.

**Solution**: Add a generic `call()` method to `Db` that reuses the existing internal `post()` function (same `WORKER_URL`, same `Bearer` auth, same error handling):

```typescript
export interface Db {
  // ... existing methods ...

  /** Call a custom Worker endpoint (non-SQL). Reuses Worker URL and auth. */
  call<T = unknown>(path: string, body: unknown): Promise<T>;
}
```

Implementation in `createDb()`:

```typescript
const db: Db = {
  // ... existing query/execute/batch ...

  async call<T>(path: string, body: unknown): Promise<T> {
    return post<T>(path, body);  // reuses the existing private post() helper
  },
};
```

This keeps the Worker client as the single HTTP transport layer. Data layer functions call `db.call("/api/v1/fts-search", { ... })` instead of constructing their own HTTP client. No new dependencies, no env var leakage into `src/data/`.

---

## API Layer

### New endpoint: `GET /api/search?q=...`

A dedicated search route, separate from the existing `GET /api/posts`. This avoids modifying the current API shape and keeps the search concern isolated.

File: `src/app/api/search/route.ts`

```typescript
// GET /api/search?q=边缘计算&page=1&page_size=10
// Internally calls searchPosts() → Worker POST /api/v1/fts-search
// Always returns published posts only (public endpoint)
```

Response shape (matches `SearchResult` interface in data layer):

```json
{
  "posts": [/* PostWithCategory[] */],
  "snippets": {
    "01JA...": "...Cloudflare <mark>Workers</mark> provides..."
  },
  "total": 42,
  "page": 1,
  "pageSize": 10
}
```

The existing `GET /api/posts` is **not modified** — its response shape `{ posts, total }` remains unchanged.

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

### FTS Sync on Delete

`PostService.delete()` must capture `rowid` **before** the primary deletion, because the main table row will be gone by the time fts-sync executes.

```typescript
// In PostService.delete():
const existing = await getPostById(db, id);  // already fetched for side effects

// Capture rowid before deletion (SELECT rowid FROM posts WHERE id = ?)
const rowid = await getPostRowid(db, id);

const deleted = await deletePost(db, id);
if (!deleted) return false;

// Best-effort FTS cleanup — rowid was captured before deletion
if (rowid != null) {
  try {
    await ftsSync({ action: "delete", rowid });
  } catch (e) {
    console.error("[FTS] delete sync failed for rowid", rowid, e);
  }
}
```

**Note**: `getPostRowid()` is a new helper that returns `SELECT rowid FROM posts WHERE id = ?`. This must run before `deletePost()` — after deletion, the rowid is unrecoverable.

If FTS sync fails silently, the index becomes stale for that post. The admin `fts-rebuild` endpoint is the recovery mechanism.

---

## Frontend — Admin (Command Palette) — OUT OF SCOPE

> **Deferred to a separate feature.** The admin command palette (`cmdk`, `⌘K` shortcut, page navigation dialog) is a standalone UI enhancement unrelated to FTS content search. It adds dependencies (`cmdk`, `@radix-ui/react-dialog`), new UI components (`dialog.tsx`, `command.tsx`), and changes to `sidebar.tsx` + `post-filters.tsx`. Bundling it with FTS would inflate the change surface and slow down review.
>
> See future doc: `21-admin-command-palette.md` (to be created).

---

## Frontend — Blog (Search Bar + Results Page)

### 1. Blog Search Bar in Sidebar

File: `src/components/blog/search-input.tsx` (new client component)

Position: below social links, above categories section (first `blog-sidebar-section`).

```
┌─────────────────────────┐
│      Site Name          │
│      Tagline            │
│   [social icons row]    │
│                         │
│   [ 🔍 Search...    / ] │  ← NEW
│                         │
│   📁 Categories         │
│   🏷️ Tags              │
│   📦 Archives           │
└─────────────────────────┘
```

Implementation:

The search bar is a **native GET form** that works without JavaScript. The client component layer only adds the `/` keyboard shortcut as progressive enhancement.

```tsx
"use client";

import { useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { useLocale } from "@/i18n/context";

export function SearchInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useLocale();

  // Progressive enhancement: "/" key focuses search input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !isTyping(e)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <form action="/search" method="get" className="blog-search">
      <Search className="blog-search-icon" strokeWidth={1.5} />
      <input
        ref={inputRef}
        name="q"
        type="search"
        placeholder={t("blog.search.placeholder")}
        className="blog-search-input"
      />
      <kbd className="blog-search-kbd">/</kbd>
    </form>
  );
}

// Don't steal "/" when user is typing in an input/textarea/contenteditable
function isTyping(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable === true;
}
```

**Progressive enhancement strategy**: The `<form action="/search" method="get">` submits natively — works with JS disabled, crawlers can follow the form action, and the browser handles URL encoding. The client component wrapper (`"use client"`) is only needed for the `/` keyboard shortcut `useEffect`. No `useState`, no `router.push`, no `preventDefault`.

#### Integration into `BlogSidebar`

File: `src/components/blog/blog-sidebar.tsx`

Insert `<SearchInput />` between the social links block and the first `blog-sidebar-section` (categories):

```tsx
import { SearchInput } from "./search-input";

// ... inside BlogSidebar render, after social links:
<SearchInput />

{/* Categories */}
{categories.length > 0 && (
  <nav className="blog-sidebar-section">
```

### 2. Blog Search Results Page

Route: `src/app/(blog)/search/page.tsx` (Server Component)

- Reads `searchParams.q` and `searchParams.page`
- Calls `searchPosts(db, { query, page, pageSize: 10 })`
- Renders result count header: "{total} results for '{query}'" / "搜索 '{query}' 共 {total} 条结果"
- Renders `PostCard` list with `snippet` prop from `snippets[post.id]`
- Renders `Pagination` component (**requires extension** — see Pagination Changes below)
- Empty state: no results message with search suggestions
- SEO: `noindex` — `export const metadata = { robots: { index: false } }`

```tsx
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page } = await searchParams;
  if (!q?.trim()) {
    // Show empty search prompt
    return <SearchEmptyPrompt />;
  }

  const db = getDb();
  const currentPage = page ? parseInt(page, 10) : 1;
  const pageSize = 10;
  const result = await searchPosts(db, {
    query: q.trim(),
    page: currentPage,
    pageSize,
  });
  const totalPages = Math.ceil(result.total / pageSize);

  return (
    <div className="blog-search-results">
      <h1>{t(locale, "blog.search.resultsTitle", { query: q, total: String(result.total) })}</h1>
      {result.posts.length === 0 ? (
        <p>{t(locale, "blog.search.noResults")}</p>
      ) : (
        <>
          {result.posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              locale={locale}
              snippet={result.snippets[post.id]}
            />
          ))}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            basePath="/search"
            locale={locale}
            searchParams={{ q }}
          />
        </>
      )}
    </div>
  );
}
```

### 2b. Pagination Component Extension

The existing `Pagination` component generates path-segment URLs (`/basePath/page/2`).
Search needs query-string URLs (`/search?q=foo&page=2`). Extend the component:

```typescript
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
  locale: Locale;
  /** When provided, generates query-string pagination (?key=val&page=N)
   *  instead of path-segment pagination (/basePath/page/N). */
  searchParams?: Record<string, string>;
}
```

Update the `href` function inside `Pagination`:

```typescript
const href = (page: number) => {
  if (searchParams) {
    // Query-string mode: /search?q=foo&page=2
    const params = new URLSearchParams(searchParams);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }
  // Path-segment mode (existing behavior): /basePath/page/2
  if (page <= 1) return basePath === "/" ? "/" : basePath;
  const base = basePath === "/" ? "" : basePath;
  return `${base}/page/${page}`;
};
```

This is backward-compatible — all existing callers omit `searchParams` and get the
same path-segment behavior. Only the search page passes `searchParams={{ q }}`.

### 3. PostCard Changes

The existing `PostCard` component (`src/components/blog/post-card.tsx`) needs two additions to support search snippets:

```typescript
interface PostCardProps {
  post: PostWithCategory;
  locale: Locale;
  author?: string;
  priority?: boolean;
  snippet?: string;  // NEW: FTS5 HTML snippet with <mark> tags
}
```

Rendering logic change in the excerpt section:

```tsx
{/* Excerpt — snippet overrides when provided */}
{(snippet || post.excerpt) && (
  snippet
    ? <p className="mt-3 text-base leading-relaxed text-blog-text"
         dangerouslySetInnerHTML={{ __html: sanitizeSnippet(snippet) }} />
    : <p className="mt-3 text-base leading-relaxed text-blog-text">
        {post.excerpt}
      </p>
)}
```

Sanitizer (only allows `<mark>` tags, collapses CJK inter-word spaces):

```typescript
function sanitizeSnippet(html: string): string {
  // Strip all tags except <mark> and </mark>
  let s = html.replace(/<\/?(?!mark\b)[^>]+>/gi, "");
  // Collapse spaces between CJK characters (segmentation artifact)
  // Handles mark tags in between: "边缘</mark> <mark>计算" → "边缘</mark><mark>计算"
  // Loop because each replace handles one adjacent pair
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(
      /([\u4e00-\u9fff])(<\/mark>)?\s+(<mark>)?([\u4e00-\u9fff])/g,
      "$1$2$3$4",
    );
  }
  return s;
}
// "使用 cloudflare 构建 <mark>边缘</mark> <mark>计算</mark> 应用"
// → "使用 cloudflare 构建<mark>边缘</mark><mark>计算</mark>应用"
```

**Why CJK space collapsing**: FTS5 stores segmented text with spaces between Chinese words (e.g., "边缘 计算"). snippet() returns this segmented form. The sanitizer removes inter-word spaces between CJK characters to produce natural Chinese display ("边缘计算") while preserving spaces around Latin words ("cloudflare").

**Safety note**: The `snippet` HTML comes from FTS5's `snippet()` function which only injects `<mark>` and `</mark>` tags into text that was already stored in the database (author-controlled content). The `sanitizeSnippet()` function strips everything except `<mark>` tags as a defense-in-depth measure.

### 4. Styles

File: `src/app/globals.css`

```css
/* Blog search bar (sidebar) */
.blog-search {
  display: flex;
  align-items: center;
  gap: 0.5em;
  margin-top: 1.5em;
  padding: 0.5em 0.75em;
  border: 1px solid var(--blog-separator);
  border-radius: 0.5em;
  transition: border-color 0.15s;
}
.blog-search:focus-within {
  border-color: var(--blog-accent);
}
.blog-search-icon {
  width: 1em;
  height: 1em;
  color: var(--blog-muted);
  flex-shrink: 0;
}
.blog-search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.9375em;
  color: var(--blog-text);
  outline: none;
}
.blog-search-input::placeholder {
  color: var(--blog-muted);
}
.blog-search-kbd {
  font-size: 0.75em;
  color: var(--blog-muted);
  border: 1px solid var(--blog-separator);
  border-radius: 0.25em;
  padding: 0.1em 0.4em;
  font-family: inherit;
  line-height: 1;
}

/* Search results page */
.blog-search-results h1 {
  font-size: 1.25em;
  font-weight: 600;
  color: var(--blog-text);
  margin-bottom: 1.5em;
}

/* FTS snippet highlight */
.blog-search-results mark,
.blog-entry mark {
  background: color-mix(in srgb, var(--blog-accent) 20%, transparent);
  color: inherit;
  padding: 0.1em 0.2em;
  border-radius: 2px;
}
```

### 5. Translation Keys

New keys added to `en.json` and `zh.json`:

| Key | EN | ZH |
|---|---|---|
| `blog.search.placeholder` | `Search...` | `搜索...` |
| `blog.search.resultsTitle` | `{total} results for "{query}"` | `搜索 "{query}" 共 {total} 条结果` |
| `blog.search.noResults` | `No results found. Try different keywords.` | `未找到相关结果，请尝试其他关键词。` |
| `blog.search.prompt` | `Enter a keyword to search posts.` | `输入关键词搜索文章。` |

---

## Atomic Commits

| # | Commit | Files | Status |
|---|--------|-------|--------|
| 1 | `feat(db): add FTS5 search migration` | `scripts/migrations/013-fts5-search.sql` | Done |
| 2 | `feat(worker): add FTS segmentation and search endpoints` | `worker/src/index.ts`, `worker/src/fts.ts` | Done |
| 3 | `feat(lib): add Db.call() for custom Worker endpoints` | `src/lib/db.ts` | Done |
| 4 | `feat(data): add searchPosts() and getPostRowid() functions` | `src/data/entities/post.ts` | Done |
| 5 | `feat(service): integrate FTS sync into PostService` | `src/services/post-service.ts` | Done |
| 6 | `test(data): add searchPosts and FTS sync unit tests` | `src/data/entities/post.test.ts` | Done |
| 7 | `feat(api): add dedicated GET /api/search endpoint` | `src/app/api/search/route.ts` | Done |
| 8 | `feat(ui): add snippet prop to PostCard with safe HTML rendering` | `src/components/blog/post-card.tsx`, `src/lib/sanitize-snippet.ts` | Done |
| 9 | `feat(blog): add SearchInput sidebar component` | `src/components/blog/search-input.tsx`, `src/components/blog/blog-sidebar.tsx`, CSS, i18n | Done |
| 10 | `feat(blog): add /search results page` | `src/app/(blog)/search/page.tsx`, `src/components/blog/pagination.tsx` | Done |
| 11 | `test(e2e): add search API E2E tests` | `e2e/api/search.test.ts` | Done |
| 12 | `chore: run fts-rebuild on production` | One-time migration step (manual) | Pending deploy |

---

## Testing Strategy

| Layer | What | How |
|---|---|---|
| **L1 UT** | `segmentText()` — CJK, English, mixed, empty, special chars | Pure function tests (Node 18+ has `Intl.Segmenter`) |
| **L1 UT** | `searchPosts()` — query building, pagination, snippet extraction | Mock DB calls |
| **L1 UT** | `sanitizeFtsQuery()` — escape FTS5 special chars, quoted phrases | Pure function tests |
| **L1 UT** | `sanitizeSnippet()` — strips non-mark tags, collapses CJK spaces, preserves Latin spaces | Pure function tests |
| **L1 UT** | `SearchInput` — native GET form with action="/search", `/` key focuses input | React Testing Library |
| **L1 UT** | `PostCard` with snippet — renders `<mark>` safely, strips other tags | React Testing Library |
| **L2 Lint** | All new files pass ESLint strict mode | Pre-commit hook |
| **L3 E2E** | `POST /api/v1/fts-search` — verify results, snippet content, BM25 ranking | API E2E against real D1 |
| **L3 E2E** | `POST /api/v1/fts-search` with Chinese query — verify CJK search works | API E2E against real D1 |
| **L3 E2E** | `POST /api/v1/fts-search` with nonexistent query — empty results, correct shape | API E2E |
| **L3 E2E** | `POST /api/v1/fts-sync` — verify index updates after post create/update/delete | API E2E |
| **L3 E2E** | `GET /api/search?q=...` — verify public search endpoint returns correct shape | API E2E |

---

## Performance Considerations

| Concern | Mitigation |
|---|---|
| FTS5 index size | Default stored mode stores both inverted index and segmented text. Larger than contentless mode, but still < 10 MB for ~1000 posts. Acceptable trade-off for working snippet()/highlight(). |
| Query latency | FTS5 MATCH is O(log n) vs O(n) for LIKE. Sub-10ms for typical queries. |
| Segmentation overhead | `Intl.Segmenter` runs in-process on the V8 runtime — microseconds per query. No external service calls. |
| Extra round-trip | Search queries go Next.js → Worker (segmentation + FTS5) → D1. This is the same hop count as existing queries (Next.js → Worker proxy → D1). No additional latency. |
| D1 edge reads | FTS5 queries are read-only and benefit from D1's global read replicas. |
| FTS rebuild | ~500 posts × segmentation + batch INSERT: < 2 seconds. D1.batch() is atomic. |
| Index staleness | Best-effort sync on write; fts-rebuild as recovery. Acceptable for a personal blog. |

---

## D1 Compatibility — Verified

Tested on D1 remote (test env `firefly-db-test`) on 2026-03-29:

| Feature | Result |
|---|---|
| `CREATE VIRTUAL TABLE ... USING fts5(...)` | ✅ Works |
| `INSERT INTO posts_fts` | ✅ Works |
| `SELECT ... WHERE MATCH 'english'` | ✅ Works |
| `unicode61` tokenizer on pre-segmented Chinese | ✅ Works (space-delimited tokens) |
| `unicode61` tokenizer on raw Chinese (no spaces) | ❌ Fails — entire string = 1 token |
| `trigram` tokenizer | ✅ Works for ≥3 chars, ❌ fails for 2-char Chinese words |
| `bm25()` ranking | ✅ Works |
| `snippet()` with default stored mode | ✅ Works — returns highlighted segmented text |
| `snippet()` with `content=''` (contentless) | ❌ Returns empty string |
| `snippet()` with `content='posts'` + segmented index | ❌ Highlight positions misaligned (original text ≠ segmented tokens) |

This confirms the application-layer segmentation approach is necessary and sufficient.

---

## Open Questions

1. **Admin search**: The existing `listPosts()` LIKE filter continues to work for admin and MCP. A future enhancement could route admin search through FTS5 too, but this is out of scope.

2. **Search scope expansion**: Should we search tags and categories too? Deferred — can be added later by expanding the FTS5 table or adding a secondary lookup.

3. **Stale index recovery**: The `fts-rebuild` endpoint is manual. A future cron job or health check could detect and auto-repair staleness, but for a personal blog this is overkill.

## Resolved Design Decisions

1. **Delete path rowid capture**: `PostService.delete()` queries `rowid` before the primary deletion and passes it directly to `fts-sync { action: "delete", rowid }`, avoiding the race condition where the main table row is already gone.

2. **Worker transport**: All FTS endpoints use POST (matching the existing `/api/v1/*` contract). `fts-search` accepts query parameters in the JSON body, not as URL query strings.

3. **API boundary**: `GET /api/posts` is **not modified**. Search is served by a dedicated `GET /api/search` endpoint with its own response shape. This eliminates backward compatibility risk.

4. **PostCard snippet rendering**: `PostCard` gains an optional `snippet` prop. When present, it renders via `dangerouslySetInnerHTML` with a tag whitelist (only `<mark>`) instead of plain text excerpt.

5. **Admin command palette — out of scope**: The `cmdk` command palette (`⌘K` page navigation dialog) is a standalone UI enhancement unrelated to FTS content search. Deferred to `21-admin-command-palette.md` to keep this feature focused and shippable.

6. **Blog search UX**: Native `<form action="/search" method="get">` — works without JavaScript. The client component wrapper only adds the `/` keyboard shortcut as progressive enhancement. No `useState`, no `router.push`, no `preventDefault`.

7. **Db.call() extension**: New `call<T>(path, body)` method on the `Db` interface, reusing the existing internal `post()` helper (same `WORKER_URL`, same Bearer auth, same error handling). This gives `searchPosts()` in the data layer a clean way to call `POST /api/v1/fts-search` without breaking the architecture boundary — no env var leakage, no separate HTTP client.

8. **snippet() column selection**: Use `snippet(posts_fts, -1, ...)` (auto-select best matching column) instead of a fixed column index. When a query only matches the title, a fixed `column=1` (content) returns unhighlighted body text. Column `-1` automatically picks the column with the best match, ensuring highlight markers always appear in the snippet.

9. **Stable pagination sort**: `ORDER BY bm25(...), p.published_at DESC, p.rowid DESC`. BM25 alone is not a stable sort — rows with equal scores can shift between pages under `LIMIT/OFFSET`. Adding `published_at` and `rowid` as deterministic tie-breakers guarantees consistent paging.

10. **FTS5 storage mode**: Default stored mode (no `content=` parameter) instead of contentless or external content. Verified on local sqlite3: `content=''` makes snippet()/highlight() return empty; `content='posts'` fails because the external table stores original unsegmented text while the index stores segmented tokens, so highlight positions don't align. Default stored mode keeps segmented text inside FTS5 where snippet() can read it directly.

11. **Pagination query-string mode**: The existing `Pagination` component uses path-segment URLs (`/basePath/page/N`), incompatible with search's query-string pagination (`/search?q=foo&page=2`). Rather than creating a separate component, extend `Pagination` with an optional `searchParams` prop. When present, `href()` builds `URLSearchParams`-based URLs. All existing callers are unaffected (no `searchParams` = existing path-segment behavior).
