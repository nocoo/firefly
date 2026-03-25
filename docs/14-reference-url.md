# 14 — Reference URL (Link Bookmark)

## Problem

Blog posts often reference external resources — a GitHub project that inspired the article, a thread being discussed, or a tool being reviewed. Currently there is no structured way to attach a source link. Authors either embed raw URLs in the body text (easy to miss, no visual emphasis) or skip the reference entirely.

Other platforms solve this with "bookmark cards" — a rich preview card showing the linked page's title, description, and thumbnail. Notion, Medium, and Ghost all have this. Firefly does not.

## Design Decision

**Server-side URL unfurl triggered by explicit user action, with optional AI enhancement.**

### Principles

1. **AI as enhancement, not dependency** — unfurl succeeds with raw OG metadata alone. When AI is configured, it translates to Chinese, trims to card-friendly length, and fills gaps. When AI is unavailable, the raw OG title/description are returned as-is. The feature never fails just because AI is not configured.
2. **Editable output** — whether AI-enhanced or raw, the fields land in an editable form. The user can tweak title and description before saving. No black-box automation.
3. **Persistent storage** — unfurled data is stored as four columns on `posts` (added by migration `009`, building on the schema established in `001-init.sql` and extended by `003-content-html.sql` through `008-site-identity.sql`). No re-fetching on every page view. Text fields (title, description) render purely from DB. Image rendering does involve an external request when `reference_image` is a third-party URL (see image strategy below).
4. **Graceful image fallback** — `reference_image` stores the actual image URL when available (from `og:image` or GitHub README). When null, the frontend renders a branded icon placeholder via pure CSS — no external requests. When non-null, the `<img>` tag loads from the stored URL, which is an external request. This is an accepted trade-off: proxying/re-hosting every OG image would add storage cost and complexity disproportionate to the benefit. Future optimization: optionally download and re-host images to R2 (not in scope for v1).
5. **Dual entry point** — accessible from both admin editor UI (button click) and MCP tools (programmatic). Same service layer, two interfaces.
6. **Explicit refresh** — clicking "重新获取" forces a fresh fetch. No automatic cache or TTL for now; the action is always user-initiated.

### Why standalone `/api/unfurl` (not slug-based)

Unlike excerpt generation which reads content from DB by slug, unfurl needs to work **before a post is saved** (user is composing a new post, pastes a URL, clicks "Fetch"). A standalone endpoint accepting `{ url }` allows this. The MCP tool adds a slug-based mode that auto-saves results to a post.

### Image priority chain

| Priority | Condition | Source | Storage |
|----------|-----------|--------|---------|
| 1 | Page has `og:image` | OG image URL | Saved to `reference_image` |
| 2 | GitHub repo, README has image | First image in README.md (best-effort) | Saved to `reference_image` |
| 3 | Known brand (GitHub, Twitter, YouTube, etc.) | CSS: brand color bg + matching Lucide icon | `reference_image` = NULL |
| 4 | Unknown site, no image | CSS: neutral bg + domain initial or generic link icon | `reference_image` = NULL |

**Notes on image strategy:**
- `og:image` is the primary source — most sites provide it and it's the most reliable.
- GitHub README image extraction is **best-effort enhancement only**: README may be `.rst`, may have no images, may use complex relative paths, or the branch may not be `main`/`master`. Failure here silently falls through to priority 3.
- Priorities 3–4 are pure CSS/SVG — no external requests when `reference_image` is NULL.
- When `reference_image` is non-NULL, the stored URL is rendered as `<img src>`, which is an external request to the original image host. This is the standard behavior for OG images across the web (same as how Twitter/Slack/Discord render link previews). Re-hosting to R2 is a future optimization.
- Favicon-based fallback was considered but rejected: favicons are often tiny (16x16) and would still require an external request.

### AI failure strategy

The unfurl pipeline has two distinct phases:

```
Phase 1: Fetch + Extract (required)     Phase 2: AI Enhancement (optional)
─────────────────────────────────        ──────────────────────────────────
fetch HTML → extract OG metadata         translate + summarize via LLM
                                         ↓ (failure)
                                         fall through to raw OG data
```

| Scenario | Behavior |
|----------|----------|
| Fetch succeeds, AI succeeds | Return AI-enhanced title + description |
| Fetch succeeds, AI fails or not configured | Return raw OG title/description (possibly English, possibly long) |
| Fetch succeeds, no OG metadata, AI succeeds | AI extracts from page body |
| Fetch succeeds, no OG metadata, AI fails | Return `<title>` tag or hostname as title, empty description — user can edit |
| Fetch fails (timeout, 4xx/5xx, SSRF blocked) | Return error immediately |

### Security constraints (SSRF protection)

`fetchHtml()` enforces:

- **Protocol whitelist**: only `http:` and `https:` — reject `file:`, `data:`, `ftp:`, etc.
- **Private network guard**: reject URLs resolving to `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7`
- **Timeout**: 10 seconds via `AbortController`
- **Response size limit**: read at most 2 MB of response body, discard the rest
- **Content-Type gate**: only proceed if response `Content-Type` contains `text/html` — reject binary, JSON, etc.
- **Redirect handling**: `fetch` with `redirect: "manual"`. The code manually follows redirects (up to 5 hops), validating each intermediate URL against the SSRF guard **before** issuing the next request. This prevents a public URL from 302-ing into a private network address — the request is aborted before the private-network fetch occurs.
- **User-Agent**: `FireflyBot/1.0 (link preview)` — honest identification

### Error semantics

| HTTP Status | Meaning | When |
|-------------|---------|------|
| 200 | Success | Unfurl completed (with or without AI enhancement) |
| 400 | Client error | Missing/invalid URL, SSRF blocked (protocol or private IP) |
| 502 | Upstream error | Target URL returned non-2xx, timeout, or connection refused |

Note: AI failure is **not** an error status — the response degrades gracefully to raw metadata with `"ai_enhanced": false` in the response body. When no OG metadata is found and AI is unavailable, the response still succeeds (200) with the `<title>` tag or hostname as title and empty description — the user can always edit the fields manually.

## Implementation

All verification commands follow `package.json` scripts (pnpm-based). Prior docs (e.g. `09-ai-excerpt.md`) reference bun — that reflects the earlier toolchain; this document uses the current convention.

### Step 1: Database migration ✅

**File**: `scripts/migrations/009-reference-url.sql` (new)

```sql
ALTER TABLE posts ADD COLUMN reference_url TEXT;
ALTER TABLE posts ADD COLUMN reference_title TEXT;
ALTER TABLE posts ADD COLUMN reference_description TEXT;
ALTER TABLE posts ADD COLUMN reference_image TEXT;
```

All nullable, all optional. Follows the same `ALTER TABLE ADD COLUMN` pattern as `004-ai-settings.sql` through `008-site-identity.sql`.

### Step 2: Types and data layer ✅

**File**: `src/models/types.ts`

Add to `Post` interface after `wp_permalink` (the interface mirrors the cumulative schema from migrations `001` through `009`):

```typescript
reference_url: string | null;
reference_title: string | null;
reference_description: string | null;
reference_image: string | null;
```

**File**: `src/data/posts.ts`

- `CreatePostInput` — add 4 optional `string | undefined` fields (undefined = not provided, field defaults to NULL in DB)
- `UpdatePostInput` — add 4 optional `string | null | undefined` fields (undefined = don't touch, null = clear to NULL, string = set value)
- `createPost()` — extend INSERT SQL columns + VALUES placeholders + params array. These fields do not trigger any computed side-effects (unlike `content` which triggers `reading_time`/`content_html`/`excerpt` recomputation).
- `updatePost()` — add 4 `if (input.xxx !== undefined)` SET blocks after `featured_image`, before `comment_enabled`. Simple passthrough — no special null handling beyond what the dynamic SET pattern already does.

### Step 3: URL unfurl service ✅

**File**: `src/services/unfurl.ts` (new)

```
unfurlUrl(url: string): Promise<UnfurlRawResult>
├── validateUrl(url)           — protocol whitelist + SSRF guard
├── fetchHtml(url)             — 10s timeout, 2MB limit, content-type gate, redirect follow
├── extractOgMetadata(html)    — regex: og:title/description/image + <title> fallback
├── extractBodyText(html)      — strip tags, collapse whitespace, truncate to 3000 chars
└── (if GitHub) fetchGitHubReadmeImage(url)  — best-effort, silent failure
```

**Return type**:

```typescript
interface UnfurlRawResult {
  url: string;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  pageTitle: string | null;       // <title> tag fallback
  bodyText: string;               // cleaned, truncated page text for AI input
  readmeImage: string | null;     // GitHub-only enhancement
}
```

No heavy dependencies — regex-based OG extraction, no cheerio/jsdom.

`extractOgMetadata` handles both attribute orders:
- `<meta property="og:title" content="...">`
- `<meta content="..." property="og:title">`

`extractBodyText` strips all HTML tags, collapses whitespace, and truncates to `MAX_UNFURL_BODY_CHARS = 3000`. This becomes the AI input alongside OG metadata.

`fetchGitHubReadmeImage` is best-effort:
- Only runs for `github.com/{owner}/{repo}` URLs (not gists, not org pages)
- Tries `main` branch then `master` via raw.githubusercontent.com
- Extracts first markdown image `![...](url)`, resolves relative paths
- Any failure (404, timeout, no images, complex paths) → returns `null` silently

### Step 4: AI summarization ✅

**File**: `src/services/ai.ts`

Add `summarizeUnfurl(ogTitle, ogDescription, bodyText)`:

- Reuses `resolveAiConfig()` → `createAiClient()` → `generateText()` pipeline
- Includes reasoning fallback (same as `generateExcerpt`)
- **Never throws** — returns `null` on any failure:
  - AI not configured (no provider/key) → `null`
  - Model timeout / rate limit / network error → catch, log warning, return `null`
  - Response format unexpected (not two lines) → best-effort parse, fall through to `null` if unparseable

```typescript
export async function summarizeUnfurl(
  ogTitle: string | null,
  ogDescription: string | null,
  bodyText: string,
): Promise<{ title: string; description: string } | null>
```

Returns `null` when AI is unavailable or fails for any reason, allowing the caller to use raw OG data. This is the key difference from `generateExcerpt()` which throws on failure — unfurl treats AI as best-effort enhancement.

Prompt:
```
You are a bookmark metadata writer. Given a web page's metadata, write a clean title and description.

Rules:
- Title: ≤50 characters, the project/article name — no site name suffix
- Description: ≤150 characters, one-sentence summary of what it is/does
- If the original content is in English, translate both title and description to Chinese
- If the original is already in Chinese, keep it as-is
- Output format: exactly two lines — first line is title, second line is description
- No quotes, no labels, no markdown
```

### Step 5: API route ✅

**File**: `src/app/api/unfurl/route.ts` (new)

```
POST /api/unfurl
Body: { url: string }

→ 200 { url, title, description, image, ai_enhanced: boolean }
→ 400 { error: "url is required" }
→ 400 { error: "Invalid URL format" }
→ 400 { error: "URL not allowed: private network" }
→ 502 { error: "Failed to fetch URL: ..." }
```

**Orchestration logic**:

```typescript
// 1. Fetch + extract (required)
const raw = await unfurlUrl(url);

// 2. AI enhancement (optional, graceful fallback)
const ai = await summarizeUnfurl(raw.ogTitle, raw.ogDescription, raw.bodyText);

// 3. Assemble response
const title = ai?.title ?? raw.ogTitle ?? raw.pageTitle ?? new URL(url).hostname;
const description = ai?.description ?? raw.ogDescription ?? "";
const image = raw.ogImage ?? raw.readmeImage ?? null;
const aiEnhanced = ai !== null;

return jsonResponse({ url, title, description, image, ai_enhanced: aiEnhanced });
```

### Step 6: Admin editor UI ✅

**File**: `src/components/admin/post-form.tsx`

New section below `featured_image` input:

```
Reference URL (optional)
┌────────────────────────────┬──────┬──────┐
│ https://github.com/...     │ 获取 │ 清除 │
└────────────────────────────┴──────┴──────┘

(after fetch, editable preview appears)
┌──────────────────────────────────────┐
│  Title:  [editable input]            │
│  Description: [editable textarea]    │
│  Image: [thumbnail preview]          │
└──────────────────────────────────────┘
```

- 5 new state vars: `referenceUrl`, `referenceTitle`, `referenceDescription`, `referenceImage`, `isUnfurling`
- `handleUnfurl()` — calls `POST /api/unfurl`, fills state on success, shows error on failure
- `handleClearReference()` — clears all reference state
- Button text toggles: "获取" → "重新获取" (after first fetch) → "获取中..." (loading)
- `handleSubmit` body: for create, use `undefined` for empty fields (omit from body); for update, use `null` to clear existing data when user has emptied the field

**API route changes required**: `POST /api/posts/route.ts` uses a **whitelist** — it explicitly picks fields to pass to `createPost()` (line 69-79). The 4 reference fields must be added to this whitelist. `PUT /api/posts/[slug]/route.ts` uses spread (`const { tag_ids, ...updateInput } = body`) so it transparently passes new fields — no change needed there.

**Admin preview compatibility**: `article-body.tsx` gains a new `referenceCard` prop (Step 7). The admin `MarkdownPreview` component also passes this prop to ensure preview parity. Both the blog page and admin preview consume the same `ArticleBody` interface.

### Step 7: Frontend display ✅

**File**: `src/components/blog/reference-card.tsx` (new)

```
┌──────────┬───────────────────────────┐
│          │  Title                     │
│  Image   │  Description text...       │
│          │  🔗 github.com             │
└──────────┴───────────────────────────┘
         entire card = <a target="_blank" rel="noopener noreferrer nofollow">
```

- Desktop: horizontal (left image 200px, right text)
- Mobile ≤640px: vertical (image on top, text below)
- Hover: border-color transition
- `rel="noopener noreferrer nofollow"` — security + SEO best practice for external links
- Uses `getDomainBrand()` for icon fallback when `reference_image` is null

**File**: `src/lib/domain-brand.ts` (new)

Seed mapping of domain → `{ Icon: LucideIcon, color: string }`. Initial set:

| Domain | Icon | Color |
|--------|------|-------|
| `github.com` | `Github` | `#24292f` |
| `x.com` / `twitter.com` | `Twitter` | `#000000` / `#1da1f2` |
| `youtube.com` | `Youtube` | `#ff0000` |

This is a **seed mapping**, not a complete solution. New domains can be added incrementally. Unrecognized domains fall through to a neutral placeholder (domain initial letter on muted background).

**File**: `src/components/blog/article-body.tsx`

Add `referenceCard?: ReactNode` prop. Renders between `{featuredImage}` and `{html}`:

```tsx
{header}
{featuredImage}
{referenceCard}    ← new slot
{html && (...)}
{footer}
```

This is a prop interface change — all call sites of `<ArticleBody>` must be checked:
- `src/app/(blog)/[year]/[month]/[slug]/page.tsx` — pass referenceCard when data present
- `src/app/(blog)/preview/[id]/page.tsx` — same treatment
- `src/components/admin/markdown-preview.tsx` — accepts new reference props from PostForm, conditionally renders `<ReferenceCard>` and passes it as `referenceCard` to `<ArticleBody>`. Interface change: add `referenceUrl?`, `referenceTitle?`, `referenceDescription?`, `referenceImage?` to `MarkdownPreviewProps`.
- `src/components/admin/post-form.tsx` line 221 — mobile tab preview uses `<ArticleBody html={previewHtml} />` with minimal props (no header, no featured image). This is an intentionally simplified preview; `referenceCard` is not passed here to keep the mobile preview lightweight. No change needed.
- `src/components/admin/post-form.tsx` line 424 — desktop sidebar preview uses `<MarkdownPreview>`, which will receive the new reference props.

The prop is optional with no default, so existing call sites that don't pass it continue to work unchanged.

**File**: `src/app/globals.css`

Add `.reference-card` styles: flexbox layout, responsive breakpoint at 640px, hover transition, line-clamp for title (2 lines) and description (2 lines).

### Step 8: MCP tools ✅

**File**: `src/lib/mcp/tools/posts.ts`

Add `handleUnfurlReference(ctx, args)` — two modes:

- `{ url }` → unfurl and return results (no save, useful for previewing)
- `{ slug }` or `{ slug, url }` → unfurl and save to post. When only `slug` is provided, reads `reference_url` from the existing post; if the post has no `reference_url` and no `url` arg, returns a clear error: `"No reference URL on post and no url provided."`

**File**: `src/lib/mcp/server.ts`

Register `unfurl_reference` tool. Extend `update_post` schema with 4 reference fields (`reference_url`, `reference_title`, `reference_description`, `reference_image` — all `z.string().nullable().optional()`).

### Step 9: i18n ✅

**Files**: `src/i18n/locales/en.json`, `src/i18n/locales/zh.json`

| Key | EN | ZH |
|-----|----|----|
| `admin.postForm.referenceUrl` | Reference URL | 引用链接 |
| `admin.postForm.referenceUrlHint` | (optional) | （可选） |
| `admin.postForm.referenceTitle` | Title | 标题 |
| `admin.postForm.referenceDescription` | Description | 描述 |
| `admin.postForm.referenceImage` | Image | 图片 |
| `admin.postForm.fetch` | Fetch | 获取 |
| `admin.postForm.refetch` | Re-fetch | 重新获取 |
| `admin.postForm.fetching` | Fetching... | 获取中... |
| `admin.postForm.clear` | Clear | 清除 |

## Files Changed

| File | Action |
|------|--------|
| `docs/14-reference-url.md` | Create (this file) |
| `docs/README.md` | Edit — add row 14 |
| `scripts/migrations/009-reference-url.sql` | Create |
| `src/models/types.ts` | Edit — add 4 fields to Post |
| `src/data/posts.ts` | Edit — extend input types + create/update SQL |
| `src/services/unfurl.ts` | Create |
| `src/services/ai.ts` | Edit — add `summarizeUnfurl()` |
| `src/app/api/unfurl/route.ts` | Create |
| `src/app/api/posts/route.ts` | Edit — add 4 reference fields to POST whitelist |
| `src/components/admin/post-form.tsx` | Edit — add reference URL section |
| `src/components/admin/markdown-preview.tsx` | Edit — add reference props + pass referenceCard to ArticleBody |
| `src/components/blog/reference-card.tsx` | Create |
| `src/lib/domain-brand.ts` | Create |
| `src/components/blog/article-body.tsx` | Edit — add `referenceCard` slot |
| `src/app/(blog)/[year]/[month]/[slug]/page.tsx` | Edit — pass referenceCard prop |
| `src/app/(blog)/preview/[id]/page.tsx` | Edit — pass referenceCard prop |
| `src/app/globals.css` | Edit — add `.reference-card` styles |
| `src/lib/mcp/tools/posts.ts` | Edit — add `handleUnfurlReference` |
| `src/lib/mcp/server.ts` | Edit — register tool + extend update_post |
| `src/i18n/locales/en.json` | Edit — 9 keys |
| `src/i18n/locales/zh.json` | Edit — 9 keys |
| `src/services/unfurl.test.ts` | Create |
| `src/services/ai.test.ts` | Edit — add summarizeUnfurl tests |
| `src/lib/mcp/tools/posts.test.ts` | Edit — add unfurl handler tests |
| `e2e/api/unfurl.test.ts` | Create |

## Atomic Commits

1. `docs: add 14-reference-url feature spec`
2. `feat: add reference URL columns migration and data layer`
3. `feat: add URL unfurl service with SSRF protection`
4. `feat: add AI summarization for unfurled metadata`
5. `feat: add /api/unfurl endpoint with graceful AI fallback`
6. `feat: add reference URL editor section to post form`
7. `feat: add ReferenceCard component and blog display`
8. `feat: add unfurl_reference MCP tool`
9. `test: add unit and E2E tests for reference URL feature`

## Verification

1. `pnpm run typecheck` — zero errors
2. `pnpm run test` — all unit tests pass (unfurl service, AI summarize, MCP handler)
3. `pnpm run test:e2e:api` — all E2E pass (including /api/unfurl endpoint)
4. Manual: admin → edit post → paste GitHub URL → click "获取" → card preview fills → save → view post → reference card renders above content
5. Manual (no AI): disable AI provider → paste URL → click "获取" → raw OG metadata fills fields (English, untruncated) → still works
6. MCP: call `unfurl_reference` with `{ url: "https://github.com/..." }` → returns title/description/image
7. MCP: call `unfurl_reference` with `{ slug: "my-post" }` → unfurls post's reference_url and saves
8. Security: try `unfurl` with `http://localhost:3000`, `file:///etc/passwd`, `http://192.168.1.1` → all rejected with 400
