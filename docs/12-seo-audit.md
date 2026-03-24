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

**Fix**: Thread the locale from `getLocale()` into `buildPageMeta()`,
`websiteJsonLd()`, `blogPostingJsonLd()`, and the RSS route. Map `zh` →
`zh_CN` / `zh-CN`, `en` → `en_US` / `en` for each format.

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

`length="0"` violates RSS spec. `type` is hardcoded `image/jpeg` but images
may be PNG/WebP.

**Fix**: Either fetch Content-Length from R2 or omit `length`. Detect MIME
from URL extension.

### P2 — RSS `<language>` is hardcoded `zh-CN`

Site supports zh/en toggle but RSS always declares `zh-CN`.

**Fix**: Read locale from settings.

---

## 2. Redundancy

### P0 — `escapeXml()` duplicated in two files

Identical implementations in `sitemap.xml/route.ts` and `feed.xml/route.ts`.

**Fix**: Extract to `src/lib/xml.ts`.

### P1 — Blog color palette repeated 3–4x in `globals.css`

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

### P1 — `SocialLink` uses `useState` for hover

```tsx
const [isHovered, setIsHovered] = useState(false);
```

React state for hover triggers re-renders. Can be replaced with pure CSS
`:hover` selector to set `fill`.

**Fix**: Replace with CSS `:hover` rule, remove client state.

### P1 — Duplicate GitHub link

`BlogGlobalBar` (top-right fixed) and `BlogSidebar` both render a GitHub
link.

**Fix**: Remove from one location.

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

### P2 — Tag/Category/Archive page structure is repetitive

All listing pages follow identical pattern: fetch → PostCard list →
Pagination. Could extract a shared `PostListPage` component.

---

## 3. Speed

### P1 — No `generateStaticParams` or ISR — all pages are dynamic

Every request triggers server-side rendering + HTTP to Cloudflare Worker.
Blog content changes infrequently.

**Fix**: Add `export const revalidate = 3600` to blog pages, or implement
`generateStaticParams` for known posts/categories/tags. This would let
Next.js serve cached HTML and dramatically reduce TTFB.

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

| Priority | Task | Impact |
|----------|------|--------|
| P0 | Fix `robots.txt` — merge disallow into bot-specific groups | Prevent crawling private paths |
| P0 | Fix language signals — thread locale into OG/hreflang/JSON-LD/RSS | Eliminate contradictory signals |
| P0 | Add `generateMetadata` + canonical to all paginated routes | Fix duplicate content |
| P0 | Extract shared `escapeXml` | Code health |
| P1 | Tighten archive URL validation (reject `2026-99`) | Eliminate duplicate URLs |
| P1 | Tag thin content — threshold or noindex low-count tags | Reduce low-value pages |
| P1 | Add `alt` text to featured images | Image SEO |
| P1 | Add `revalidate` / `generateStaticParams` | TTFB reduction |
| P1 | RSS: use `content_html` | Reduce computation |
| P1 | Cache redirect map in proxy | Reduce per-request latency |
| P1 | `SocialLink` hover → pure CSS | Less client JS |
| P1 | Custom 404 page | UX + crawl quality |
| P2 | Add `CollectionPage`/`ItemList` JSON-LD to listing pages | Richer search understanding |
| P2 | Remove `WebSite` JSON-LD from paginated subpages | Correct schema semantics |
| P2 | Sitemap homepage `lastmod` → latest post date | Honest freshness signal |
| P2 | CSS palette deduplication | Maintainability |
| P2 | Sitemap image extension | Image search exposure |
| P2 | Split `BlogLayoutClient` | Reduce serialization |
