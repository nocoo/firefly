# 12 — SEO Audit Report

> Audit date: 2026-03-24
> Scope: Blog frontend (`lizheng.me`) — HTML standards, redundancy, speed

## Overall Assessment

SEO foundation is **solid**: zero third-party JS, all local fonts, complete
JSON-LD structured data, canonical URL system, semantic HTML. Issues below
are incremental improvements on an already-good base.

---

## 1. HTML Standards

### P0 — `robots.txt` rules are ambiguous for major search engines

Googlebot, Bingbot, Applebot each have a dedicated rule with only `allow: "/"`,
while the `disallow: ["/api/", "/admin/", "/login"]` entries live exclusively
in the wildcard (`*`) group. Per the robots.txt spec, a bot-specific group
**replaces** the wildcard group — it does not inherit from it. This means
major search engines may crawl `/api/` and `/admin/` paths that should be
blocked.

```typescript
// src/app/robots.ts
{ userAgent: "Googlebot", allow: "/" },   // no disallow → /api/ is open
{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin/", "/login"] },
```

**Evidence**: `src/app/robots.ts`, `src/proxy.ts` (auth guard protects admin,
but crawl budget is still wasted on 401 responses).

**Fix**: Merge disallow rules into every bot-specific group, or remove the
dedicated groups and rely solely on the wildcard rule (search engines are
already covered by `*`).

### P0 — Language signals are inconsistent across the site

`<html lang>` switches between `zh-CN` and `en` based on DB settings, but
every other language declaration is hardcoded Chinese:

| Signal | Current value | Should be |
|--------|--------------|-----------|
| `<html lang>` | dynamic ✅ | — |
| `og:locale` | `zh_CN` hardcoded ❌ | dynamic |
| `hreflang` | `zh-CN` hardcoded ❌ | dynamic |
| JSON-LD `inLanguage` | `zh-CN` hardcoded ❌ | dynamic |
| RSS `<language>` | `zh-CN` hardcoded ❌ | dynamic |

When the site is switched to English, Google sees contradictory signals:
`<html lang="en">` vs `og:locale="zh_CN"` vs `inLanguage: "zh-CN"`.

**Evidence**: `src/i18n/server.ts`, `src/app/layout.tsx` (L39, L71),
`src/lib/seo.ts` (L49), `src/lib/jsonld.ts` (L19, L48).

**Fix**: Two layers must change:

1. **Root layout** (`src/app/layout.tsx`): The `metadata` export is a static
   object, so `openGraph.locale` is hardcoded at build time. Convert it to
   a `generateMetadata()` async function that reads `getLocale()` and sets
   `locale` / `hreflang` dynamically. Without this step, the root-level OG
   locale will remain `zh_CN` regardless of other fixes.
2. **Downstream helpers**: Thread the locale into `buildPageMeta()`,
   `websiteJsonLd()`, `blogPostingJsonLd()`, and the RSS feed route. Map
   `zh` → `zh_CN` / `zh-CN`, `en` → `en_US` / `en` for each format.

### P0 — Missing `generateMetadata` on paginated/archive routes

| Route | Issue |
|-------|-------|
| `/page/[page]` | No `generateMetadata` — falls back to root default |
| `/archive/[period]` | No `generateMetadata` |
| `/archive/[period]/page/[page]` | Same |
| `/category/[slug]/page/[page]` | Same |
| `/tag/[slug]/page/[page]` | Same |

**Impact**: Google sees duplicate title + description across all these pages.
Wastes crawl budget and dilutes ranking.

**Fix**: Add `generateMetadata` to every paginated route. Append page number
to title (e.g. `- Page N`). Set distinct description per route.

### P0 — Paginated pages have wrong canonical URL

Paginated pages don't call `buildPageMeta`, so their canonical falls back to
the root layout's `alternates.canonical: SITE_URL` — **every paginated page
canonicalizes to the homepage**.

**Fix**: Each paginated route must set its own canonical via `buildPageMeta`.

### P1 — Featured image `alt` is empty

```tsx
// post-card.tsx:49, [slug]/page.tsx:146
<Image src={post.featured_image} alt="" fill ... />
```

Empty `alt` means search engines ignore the image entirely. Hurts Google
Images indexing.

**Fix**: `alt={post.title}` or a more descriptive string.

### P1 — Archive URL validation is too loose, producing duplicate content

`parseArchivePeriod()` accepts any string after the year as long as `parseInt`
doesn't return NaN within 1–12. But values like `2026-99` or `2026-foo` parse
the year successfully, skip the invalid month, and silently fall back to the
year-only archive (`/archive/2026`). This creates an infinite number of alias
URLs that all serve the same content.

```typescript
// src/app/(blog)/archive/[period]/page.tsx
if (!Number.isNaN(month) && month >= 1 && month <= 12) {
  return { year, month };
}
return { year };  // ← 2026-99 and 2026-foo land here
```

**Evidence**: `src/app/(blog)/archive/[period]/page.tsx` (L14-30),
`src/app/(blog)/archive/[period]/page/[page]/page.tsx`.

**Fix**: If the period string contains a `-` but the month part is invalid,
return `null` (→ 404) instead of silently dropping the month. Only allow the
year-only form for strings that contain no `-`.

### P1 — Tag pages are thin content but fully indexed via sitemap

Tags have no `description` field — the tag page header only shows the tag
name and post count. Every tag with `post_count > 0` is submitted to the
sitemap with `priority: 0.5`. For tags with only 1–2 posts, these are
near-empty aggregation pages that risk being flagged as thin content.

**Evidence**: `src/models/types.ts` (Tag type), `src/data/tags.ts`,
`src/app/(blog)/tag/[slug]/page.tsx`, `src/app/sitemap.xml/route.ts` (L56-63).

**Fix**: Either (a) add a `description` field to tags and require meaningful
content, or (b) set a minimum post count threshold (e.g. ≥3) for sitemap
inclusion, or (c) add `<meta name="robots" content="noindex, follow">` to
low-count tag pages to prevent indexing while preserving link equity.

### P1 — No custom 404 page (`not-found.tsx`)

Next.js renders a generic 404. Missing brand consistency and no navigation
back to valid pages.

**Fix**: Create `src/app/not-found.tsx` with blog styling and links.

### P1 — RSS `<enclosure>` has `length="0"` and hardcoded MIME

```tsx
// feed.xml/route.ts:30
<enclosure url="..." type="image/jpeg" length="0"/>
```

`length` is a **required** attribute per the RSS 2.0 spec and must contain the
file's actual byte size. `length="0"` is non-compliant. Additionally, `type`
is hardcoded to `image/jpeg` but images may be PNG or WebP.

**Evidence**: `src/app/feed.xml/route.ts` (L29-31).

**Fix**: Two valid approaches:
1. **Provide real values**: HEAD-request the R2 URL at feed build time to get
   `Content-Length` and `Content-Type`, then populate both attributes
   accurately.
2. **Remove `<enclosure>` entirely**: If fetching metadata is too expensive,
   omit the `<enclosure>` element rather than emitting a non-compliant one.
   The `<enclosure>` tag is optional in RSS 2.0.

Do **not** simply remove the `length` attribute — a `<enclosure>` without
`length` is equally non-compliant.

### P2 — Listing pages lack structured data (CollectionPage / ItemList)

Category, tag, and archive pages have no JSON-LD. Search engines understand
the site hierarchy only from the homepage `WebSite` and individual
`BlogPosting` schemas — the intermediate listing level is invisible.

**Evidence**: `src/lib/jsonld.ts` (only `websiteJsonLd`, `blogPostingJsonLd`,
`breadcrumbJsonLd`), `src/app/(blog)/category/[slug]/page.tsx`,
`src/app/(blog)/tag/[slug]/page.tsx`, `src/app/(blog)/archive/[period]/page.tsx`.

**Fix**: Add `CollectionPage` + `ItemList` JSON-LD to listing pages.
Include `BreadcrumbList` (Home → Category/Tag → page) for category and tag
pages. Example:

```json
{
  "@type": "CollectionPage",
  "name": "Category: Tech",
  "url": "https://lizheng.me/category/tech",
  "mainEntity": {
    "@type": "ItemList",
    "numberOfItems": 15,
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "url": "..." }
    ]
  }
}
```

### P2 — Paginated list pages inject homepage-level `WebSite` JSON-LD

`/page/2`, `/page/3` etc. call `websiteJsonLd()` which emits a `WebSite`
schema. The `WebSite` type is meant for the homepage entry point, not for
paginated subpages. This dilutes the semantic signal.

**Evidence**: `src/app/(blog)/page/[page]/page.tsx` (L35-37),
`src/lib/jsonld.ts`.

**Fix**: Only inject `WebSite` on the homepage (`/`). Paginated pages should
either use `CollectionPage` (see above) or omit JSON-LD entirely.

### P2 — Sitemap homepage `lastmod` uses current time, not real content date

```typescript
// src/app/sitemap.xml/route.ts:29
lastModified: new Date(),  // ← always "now"
```

Every sitemap generation sets the homepage `lastmod` to the current timestamp,
even if no content has changed. This sends a false freshness signal to search
engines, causing unnecessary re-crawls and reducing trust in the signal.

**Evidence**: `src/app/sitemap.xml/route.ts` (L28-32).

**Fix**: Use the `updated_at` timestamp of the most recently published or
updated post as the homepage `lastmod`.

### P2 — RSS `<language>` is hardcoded `zh-CN`

Site supports zh/en toggle but RSS always declares `zh-CN`.

**Fix**: Read locale from settings.

---

## 2. Code Quality (non-SEO, included for completeness)

> Items in this section are code health / DX improvements that surfaced during
> the audit. They do not directly affect search engine indexing or ranking.

### P2 — `escapeXml()` duplicated in two files

Identical implementations in `sitemap.xml/route.ts` and `feed.xml/route.ts`.

**Fix**: Extract to `src/lib/xml.ts`.

### P2 — Blog color palette repeated 3–4x in `globals.css`

| Location | Purpose |
|----------|---------|
| `:root` | Light mode (L144-162) |
| `.dark` | Dark mode (L197-214) |
| `.blog-preview-theme:not(.blog-preview-dark)` | Admin preview light (L548-563) |
| `.blog-preview-dark` | Admin preview dark (L567-583) |

Preview light values are identical to `:root`. Preview dark values are
identical to `.dark`. Changing a color requires syncing 4 places.

**Fix**: Preview inherits from `:root`/`.dark` by default. Only override when
global theme ≠ preview theme using forced `data-theme` attribute.

### P2 — `SocialLink` uses `useState` for hover

```tsx
const [isHovered, setIsHovered] = useState(false);
```

React state for hover triggers re-renders. Can be replaced with pure CSS
`:hover` selector to set `fill`.

**Fix**: Replace with CSS `:hover` rule, remove client state.

### P2 — Duplicate GitHub link

`BlogGlobalBar` (top-right fixed) and `BlogSidebar` both render a GitHub
link.

**Fix**: Remove from one location.

### P2 — Tag/Category/Archive page structure is repetitive

All listing pages follow identical pattern: fetch → PostCard list →
Pagination. Could extract a shared `PostListPage` component.

---

## 3. Speed

### P1 — No explicit ISR or static generation configured in source

No blog route exports `revalidate`, `dynamic`, or `generateStaticParams`
(verified via grep across `src/app/`). Without these, Next.js has no
source-level instruction to statically generate or incrementally cache pages.

Some data paths do have **process-level caching** (e.g. `SiteSettings` with
5-min TTL, `MonthlyArchives`, post count queries), which reduces repeated DB
calls within the same process. At the source level, however, no page-output
caching or static serving is configured. Whether the production runtime
actually re-executes the full render tree per request depends on deployment
platform behavior that the source code alone cannot confirm.

**Evidence**:
- `grep -r "export const revalidate\|export const dynamic\|generateStaticParams" src/app/` → no results
- `src/data/settings.ts` (L42-47): process-level cache exists but only for data, not page output
- No `revalidate` segment config in any route file

**Caveat**: The deployment platform may add its own response caching layer
(e.g. Vercel's Edge cache). Without inspecting production response headers
(`Cache-Control`, `x-vercel-cache`) or the `next build` output, we cannot
confirm the exact caching behavior in production. The recommendation is
based on what the source code explicitly configures.

**Fix**: Add `export const revalidate = 3600` to blog page routes, or
implement `generateStaticParams` for known posts/categories/tags. For a blog
with infrequent updates, ISR would let Next.js serve cached HTML and
significantly reduce TTFB.

### P1 — Proxy queries DB for redirect lookup on every request

```tsx
// proxy.ts — runs on EVERY public page request
const redirect = await db.firstOrNull<...>(
  "SELECT ... FROM redirects WHERE source_path = ?",
  [pathname],
);
```

Most requests return `null`. Adds one HTTP round-trip to Worker per page load.

**Fix**: Cache the redirect map in-process (same pattern as `SiteSettings`
cache with 5-min TTL). Or use a prefix/bloom filter to skip the query for
paths that can't possibly match.

### P1 — RSS feed re-renders Markdown for all 50 posts

```tsx
// feed.xml/route.ts:27
const html = renderMarkdown(post.content);
```

Posts have pre-rendered `content_html` but RSS doesn't use it.

**Fix**: `post.content_html || renderMarkdown(post.content)`.

### P2 — `BlogLayoutClient` wraps all children in client boundary

The `"use client"` component wraps the entire blog main area. All children
props must be serialized across the boundary.

**Fix**: Extract drawer/scroll-lock into a small client island. Keep main
content in the server component tree.

### P2 — Sitemap lacks `<image:image>` extension

Articles with featured images could benefit from Google Image Sitemap
extension for better image search indexing.

**Fix**: Add `xmlns:image` namespace and `<image:image>` child elements for
posts with `featured_image`.

---

## What's Already Good

- Zero third-party JavaScript
- All fonts loaded via `local()` — zero network font requests
- Complete JSON-LD: `WebSite`, `BlogPosting`, `BreadcrumbList`
- Page-level canonical URLs and OG/Twitter cards
- `robots.txt` with sitemap reference (rules need fix, see §1)
- RSS 2.0 with `content:encoded` full HTML
- External links: `rel="noopener noreferrer"`
- Comment author links: `rel="nofollow"`
- LCP: first image `priority`, comments in `<Suspense>`
- Semantic HTML: `<article>`, `<nav>`, `<aside>`, `<time>`, `<header>`, `<footer>`
- Skip-to-content link (a11y)
- `llms.txt` for AI crawlers
- XSS protection: HTML escaping + URL scheme whitelist in Markdown renderer
- Pre-rendered `content_html` on post create/update

---

## Priority Matrix

### SEO Impact (directly affects indexing, ranking, or crawl quality)

| Priority | Task | Impact |
|----------|------|--------|
| P0 | Fix `robots.txt` — merge disallow into bot-specific groups | Prevent crawling private paths |
| P0 | Fix language signals — convert root layout to `generateMetadata()`, thread locale everywhere | Eliminate contradictory signals |
| P0 | Add `generateMetadata` + canonical to all paginated routes | Fix duplicate content |
| P1 | Tighten archive URL validation (reject `2026-99`) | Eliminate duplicate URLs |
| P1 | Tag thin content — threshold or noindex low-count tags | Reduce low-value pages |
| P1 | Add `alt` text to featured images | Image SEO |
| P1 | RSS: fix `<enclosure>` (provide real length or omit element) | RSS spec compliance |
| P1 | Custom 404 page | UX + crawl quality |
| P2 | Add `CollectionPage`/`ItemList` JSON-LD to listing pages | Richer search understanding |
| P2 | Remove `WebSite` JSON-LD from paginated subpages | Correct schema semantics |
| P2 | Sitemap homepage `lastmod` → latest post date | Honest freshness signal |
| P2 | Sitemap `<image:image>` extension | Image search exposure |

### Speed (affects user experience and Core Web Vitals)

| Priority | Task | Impact |
|----------|------|--------|
| P1 | Add ISR / `revalidate` — source has no static generation config; verify production behavior via `next build` output or response headers | TTFB reduction |
| P1 | RSS: use `content_html` instead of re-rendering Markdown | Reduce computation |
| P1 | Cache redirect map in proxy | Reduce per-request latency |
| P2 | Split `BlogLayoutClient` into smaller client islands | Reduce serialization |

### Code Quality (non-SEO, maintenance improvements)

| Priority | Task | Impact |
|----------|------|--------|
| P2 | Extract shared `escapeXml` to `src/lib/xml.ts` | DRY |
| P2 | `SocialLink` hover → pure CSS | Less client JS |
| P2 | Deduplicate GitHub link (sidebar vs global bar) | UI cleanliness |
| P2 | CSS palette deduplication | Maintainability |
| P2 | Extract shared `PostListPage` component | DRY |

---

## Implementation Status (2026-03-24)

All P0 and P1 SEO/Speed items are resolved. P2 items completed where
applicable. Items marked *deferred* require design decisions or are
non-impactful enough to address later.

| # | Priority | Task | Status |
|---|----------|------|--------|
| 1 | P0 | Fix `robots.txt` — single wildcard rule | ✅ Done |
| 2 | P0 | Fix language signals — dynamic locale everywhere | ✅ Done (11 files, 20 tests) |
| 3 | P0 | Add `generateMetadata` + canonical to all paginated routes | ✅ Done (5 routes) |
| 4 | P1 | Tighten archive URL validation | ✅ Done (12 tests) |
| 5 | P1 | Tag thin content — sitemap threshold ≥3 + noindex | ✅ Done |
| 6 | P1 | Add `alt` text to featured images | ✅ Done (3 files) |
| 7 | P1 | RSS: remove non-compliant `<enclosure>` | ✅ Done |
| 8 | P1 | Custom 404 page | ✅ Done (i18n zh/en) |
| 9 | P1 | RSS: use `content_html` with markdown fallback | ✅ Done (`content_html \|\| renderMarkdown`) |
| 10 | P1 | Cache redirect map in proxy (5-min TTL) | ✅ Done |
| 11 | P2 | Add `CollectionPage`/`ItemList` JSON-LD | ✅ Done (all 8 listing routes: 4 page-1 + 4 paginated) |
| 12 | P2 | Remove `WebSite` JSON-LD from paginated subpages | ✅ Done |
| 13 | P2 | Sitemap homepage `lastmod` → latest post date | ✅ Done (MAX `updated_at` via reduce) |
| 14 | P2 | Sitemap `<image:image>` extension | ✅ Done |
| 15 | P2 | Extract shared `escapeXml` to `src/lib/xml.ts` | ✅ Done (7 tests) |
| 16 | P1 | Add ISR / `revalidate` | Deferred — requires prod behavior verification |
| 17 | P2 | Split `BlogLayoutClient` into smaller client islands | Deferred — requires design refactor |
| 18 | P2 | `SocialLink` hover → pure CSS | Deferred — non-SEO |
| 19 | P2 | Deduplicate GitHub link | Deferred — non-SEO |
| 20 | P2 | CSS palette deduplication | Deferred — non-SEO |
| 21 | P2 | Extract shared `PostListPage` component | Deferred — non-SEO |

**Test status**: 351 tests passing, 94.66% statement coverage.
