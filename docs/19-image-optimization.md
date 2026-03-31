# 19 — Image Optimization & Content Lightbox

> Optimize inline content images via Next.js image proxy, and add a
> shared lightbox component for image preview across blog frontend and admin.
>
> Date: 2026-03-27
> Prerequisite: [18-media-library.md](./18-media-library.md) (completed)
> Status: ✅ Complete

---

## Problem Statement

1. **Inline content images are unoptimized**: The markdown renderer (`src/models/markdown.ts`)
   outputs raw `<img src="..." loading="lazy">` tags. These are injected via
   `dangerouslySetInnerHTML` in `<ArticleBody>`, completely bypassing Next.js image
   optimization. Users download full-size originals (often 2–5 MB) on all devices —
   no srcset, no WebP/AVIF conversion, no responsive sizing.

2. **No image preview on blog frontend**: Clicking an inline image in a blog post does
   nothing. Users cannot zoom in on photos or diagrams. The admin media library has a
   lightbox, but it's tightly coupled to admin state (metadata panel, action buttons,
   delete flow) and cannot be reused.

3. **Admin media grid loads full-size originals**: The 16-column thumbnail grid fetches
   the original R2 URLs. With 120 items per page, this wastes bandwidth significantly.

## Goals

- Blog frontend inline images route through `/_next/image` proxy (automatic srcset,
  WebP/AVIF, responsive sizing) — **without affecting** RSS feed, DB cache, API, or backup
- Blog frontend inline images are clickable → open a minimal lightbox (image only,
  no metadata, no action buttons)
- Admin media library lightbox shares the same base overlay component
- Admin media grid thumbnails use `/_next/image` proxy for smaller transfers
- Test coverage for all rendering paths

### Non-goals (V1)

- Upload-time multi-size generation (WordPress-style pre-rendering)
- Cloudflare Image Resizing / Image Transformations
- Image dimension detection (width/height attributes for CLS prevention)
- Lightbox gallery navigation (prev/next between images)

---

## Architecture

### Rendering pipeline (current)

```
Markdown content
  ↓ renderMarkdown()              → HTML string with raw <img>
  ↓ stored in DB (content_html)   → raw <img> persisted
  ↓ served to...
    ├─ ArticleBody (DOM)          → dangerouslySetInnerHTML → raw <img> in browser
    ├─ RSS feed (XML)             → <content:encoded> CDATA
    ├─ Backup export (JSON)       → raw HTML string
    └─ MCP API (JSON)             → raw HTML string
```

### Rendering pipeline (proposed)

```
Markdown content
  ↓ renderMarkdown(md)                    → HTML with raw <img>     (unchanged, for RSS/DB/API)
  ↓ renderMarkdown(md, { optimizeImages }) → HTML with /_next/image  (new, for DOM only)
  ↓ stored in DB (content_html)            → STILL raw <img>         (unchanged)
  ↓ served to...
    ├─ ArticleBody (DOM)     → uses optimized HTML (runtime renderMarkdown with flag)
    ├─ RSS feed (XML)        → uses content_html from DB (raw <img>, unchanged)
    ├─ Backup export (JSON)  → uses content_html from DB (raw <img>, unchanged)
    └─ MCP API (JSON)        → uses content_html from DB (raw <img>, unchanged)
```

**Key insight**: The `content_html` DB cache continues storing raw `<img>` HTML. The
optimization flag is applied **at render time** on the DOM path only. Blog post page
and preview page call `renderMarkdown(post.content, { optimizeImages: true })` instead
of using `content_html`.

### Trade-off: DB cache vs runtime rendering

Using `content_html` (pre-rendered cache) for DOM paths is no longer viable when we
want optimized output. The DOM paths will call `renderMarkdown()` at request time.
This is acceptable because:

- `renderMarkdown` is synchronous and fast (~1 ms for typical posts)
- These pages are already server-rendered (SSR) with full DB queries
- The raw `content_html` cache remains useful for RSS, API, and backup (no re-rendering)

---

## Detailed Design

### 1. `renderMarkdown` options parameter

**File**: `src/models/markdown.ts`

```ts
export interface RenderMarkdownOptions {
  /** Rewrite <img> src to /_next/image proxy with srcset/sizes. Default: false */
  optimizeImages?: boolean;
}

export function renderMarkdown(
  markdown: string,
  options?: RenderMarkdownOptions,
): string;
```

When `optimizeImages` is true, the `image()` renderer outputs:

```html
<img
  src="/_next/image?url=ENCODED_URL&w=1080&q=75"
  srcset="
    /_next/image?url=ENCODED_URL&w=640&q=75   640w,
    /_next/image?url=ENCODED_URL&w=828&q=75   828w,
    /_next/image?url=ENCODED_URL&w=1080&q=75 1080w,
    /_next/image?url=ENCODED_URL&w=1920&q=75 1920w
  "
  sizes="(max-width: 900px) 100vw, min(75vw, 1000px)"
  alt="..."
  loading="lazy"
  decoding="async"
  data-original-src="ORIGINAL_URL"
>
```

**Details**:
- `src` falls back to the 1080w variant (reasonable default for blog content width)
- `srcset` uses Next.js default `deviceSizes` breakpoints (subset: 640, 828, 1080, 1920)
- `sizes` matches the blog content column width pattern (already used by featured images)
- `data-original-src` preserves the original URL for the lightbox to use
- Only rewrites URLs matching our known asset and site domains;
  external image URLs are left unchanged (no proxy for foreign domains)
- `decoding="async"` improves rendering performance

**Implementation**: Two separate `Marked` instances (singletons) — one default, one
optimized. The `getMarked()` helper selects based on the options flag. This avoids
re-creating the renderer on every call.

### 2. Call site changes

| Call site | File | Change |
|-----------|------|--------|
| DB storage (create) | `src/data/posts.ts:253` | No change — continues using `renderMarkdown(content)` |
| DB storage (update) | `src/data/posts.ts:343` | No change |
| Blog post page | `src/app/(blog)/[year]/[month]/[slug]/page.tsx:103` | Change to `renderMarkdown(post.content, { optimizeImages: true })` |
| Preview page | `src/app/(blog)/preview/[id]/page.tsx:38` | Change to `renderMarkdown(post.content, { optimizeImages: true })` |
| RSS feed | `src/app/feed.xml/route.ts:25` | No change — uses `content_html` fallback, then raw `renderMarkdown` |
| Admin preview (desktop) | `src/components/admin/markdown-preview.tsx:33` | No change — admin preview doesn't need optimization |
| Admin preview (mobile) | `src/components/admin/post-form.tsx:181` | No change |

**Note on content_html fallback**: The blog post page currently uses
`post.content_html || renderMarkdown(post.content)`. With this change, it always calls
`renderMarkdown(post.content, { optimizeImages: true })` for DOM rendering. The
`content_html` field is still written on create/update (for RSS and API consumers).

### 3. Shared image lightbox component

**File**: `src/components/ui/image-lightbox.tsx` (new)

A headless overlay component with two usage modes:

```ts
interface ImageLightboxProps {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
  /** Optional side panel content (metadata, actions, etc.) */
  children?: ReactNode;
}
```

**Rendering**:

```
open === true:
  Fixed overlay (z-50, bg-black/80, backdrop-blur-sm)
    └─ Content wrapper (max-h-[90vh], max-w-[90vw])
         ├─ Close button (X, top-right)
         ├─ Image pane (<img> centered, object-contain)
         └─ {children}  ← optional side panel slot
```

**Behavior**:
- Escape key closes
- Backdrop click closes
- Content click stops propagation
- Body scroll locked while open

**Blog frontend usage** (minimal mode):
```tsx
<ImageLightbox src={url} alt={alt} open={open} onClose={close} />
```
No children → no side panel → image only with close button.

**Admin media library usage** (full mode):
```tsx
<ImageLightbox src={url} alt={alt} open={open} onClose={close}>
  <div className="...">
    {/* filename, mime_type, size, dimensions, date */}
    {/* copy URL, copy MD, delete buttons */}
  </div>
</ImageLightbox>
```
Children slot renders as the metadata/action side panel.

### 4. Blog frontend content image click → lightbox

**Constraint**: `ArticleBody` is a server component shared by blog pages AND admin
previews. It must not be modified to include client-side interactivity. The lightbox
must only appear on public blog pages, not in admin preview panels.

**Approach**: A standalone, zero-prop client component (`ContentImageLightbox`) that
mounts **beside** `ArticleBody` in the blog page layout. It attaches a click listener
to `.blog-content img` via `document.querySelector` event delegation — no HTML string
crosses the client boundary.

**File**: `src/components/blog/content-image-lightbox.tsx` (new, `"use client"`)

```tsx
"use client";

export function ContentImageLightbox() {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = document.querySelector(".blog-content");
    if (!container) return;
    containerRef.current = container as HTMLElement;

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== "IMG") return;

      // If the image is wrapped in a link <a><img></a>, let the link navigate normally
      if (target.closest("a")) return;

      e.preventDefault();
      const img = target as HTMLImageElement;
      setLightbox({
        src: img.dataset.originalSrc || img.src,
        alt: img.alt || "",
      });
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, []);

  if (!lightbox) return null;

  return (
    <ImageLightbox
      src={lightbox.src}
      alt={lightbox.alt}
      open
      onClose={() => setLightbox(null)}
    />
  );
}
```

**Key design decisions**:
- **Zero client boundary payload**: The component has no props — no HTML string, no
  data passes through the RSC/client boundary. The `blog-content` DOM is rendered
  server-side by `ArticleBody`, and this component finds it via DOM query.
- **Link-wrapped images (`<a><img></a>`) are skipped**: `target.closest("a")` check
  ensures that linked images navigate normally instead of opening the lightbox.
- **Blog-only mounting**: Only `[slug]/page.tsx` and `preview/[id]/page.tsx` render
  `<ContentImageLightbox />` alongside `<ArticleBody>`. Admin preview components
  (`markdown-preview.tsx`, `post-form.tsx`) do NOT mount it — `ArticleBody` is
  completely unchanged.

**Usage in blog post page** (`[slug]/page.tsx`):
```tsx
<ArticleBody html={html} header={...} featuredImage={...} footer={...} />
<ContentImageLightbox />
```

**CSS**: Add `cursor: pointer` to `.blog-content img:not(a img)` in `globals.css` to
indicate clickability, excluding linked images.

### 5. Admin media library refactor

**File**: `src/components/admin/media-library.tsx`

- Replace the inline lightbox JSX (lines 454-551) with `<ImageLightbox>`:
  ```tsx
  <ImageLightbox src={preview.url} alt={preview.filename} open={!!preview} onClose={() => setPreview(null)}>
    {/* existing meta panel + action buttons, moved into children */}
  </ImageLightbox>
  ```
- No behavioral change — same UI, same features, just extracted into shared component

### 6. Admin media grid thumbnail optimization

**File**: `src/components/admin/media-library.tsx`

Replace thumbnail `<img src={item.url}>` with Next.js `<Image>`:

```tsx
import Image from "next/image";

<Image
  src={item.url}
  alt={item.alt_text ?? item.filename}
  fill
  sizes="(max-width: 640px) 33vw, (max-width: 768px) 20vw, (max-width: 1024px) 10vw, 6vw"
  className="object-cover transition-transform group-hover:scale-105"
/>
```

This routes through `/_next/image` and serves appropriately sized thumbnails instead
of full originals. The `sizes` hint matches the responsive grid (3→5→8→10→12→16 cols).

---

## Test Plan

### Unit tests — `src/models/markdown.test.ts`

New tests for the `optimizeImages` option:

| # | Test case | Assertion |
|---|-----------|-----------|
| 1 | Default mode: image renders raw `<img>` | `src` is original URL, no `srcset` |
| 2 | Optimized mode: internal image gets `/_next/image` src | `src` contains `/_next/image?url=` |
| 3 | Optimized mode: internal image gets srcset | `srcset` contains 640w, 828w, 1080w, 1920w |
| 4 | Optimized mode: internal image gets sizes | `sizes` attribute present |
| 5 | Optimized mode: `data-original-src` preserved | attribute contains original URL |
| 6 | Optimized mode: `decoding="async"` added | attribute present |
| 7 | Optimized mode: external image URL unchanged | Non-matching domain keeps raw `<img>` |
| 8 | Optimized mode: relative image URL unchanged | `/path/to/img.jpg` not rewritten |
| 9 | Optimized mode: XSS in image src still blocked | `javascript:` URL returns empty |
| 10 | Mixed content: only images are affected | headings, links, code unchanged |

### Unit tests — `src/components/ui/image-lightbox.test.tsx` (new)

Requires adding `jsdom` or `happy-dom` test environment. Since the project currently
has no component tests, and `vitest.config.ts` excludes `src/components/**` from
coverage, these tests would be **optional** for V1. The lightbox is covered by E2E.

If added:
| # | Test case |
|---|-----------|
| 1 | Renders nothing when `open` is false |
| 2 | Renders overlay + image when `open` is true |
| 3 | Calls `onClose` on backdrop click |
| 4 | Calls `onClose` on Escape key |
| 5 | Renders children in side panel when provided |
| 6 | Does not render side panel when no children |

### E2E tests

| # | Test case | Type |
|---|-----------|------|
| 1 | Blog post page: inline images have `srcset` attribute | Playwright browser |
| 2 | Blog post page: inline image `src` points to `/_next/image` | Playwright browser |
| 3 | Blog post page: click inline image opens lightbox overlay | Playwright browser |
| 4 | Blog post page: lightbox shows correct image | Playwright browser |
| 5 | Blog post page: lightbox closes on X button / Escape / backdrop | Playwright browser |
| 6 | Blog post page: click linked image (`<a><img>`) navigates, no lightbox | Playwright browser |
| 7 | RSS feed: inline images still have raw `<img>` src (no `/_next/image`) | API test |
| 8 | Admin media library: lightbox still works with metadata panel | Playwright browser |

---

## Atomic Commits

| # | Message | Scope | Tests |
|---|---------|-------|-------|
| 1 | `feat: add optimizeImages option to renderMarkdown for next/image proxy` | `src/models/markdown.ts` | Unit tests 1-10 |
| 2 | `feat: add shared ImageLightbox component` | `src/components/ui/image-lightbox.tsx` | — |
| 3 | `feat: add click-to-preview lightbox for blog content images` | `src/components/blog/content-image-lightbox.tsx`, `[slug]/page.tsx`, `preview/[id]/page.tsx`, `globals.css` | — |
| 4 | `refactor: use ImageLightbox in admin media library` | `src/components/admin/media-library.tsx` | — |
| 5 | `feat: enable optimized image rendering on blog post and preview pages` | `[slug]/page.tsx`, `preview/[id]/page.tsx` | — |
| 6 | `perf: use next/image for admin media grid thumbnails` | `src/components/admin/media-library.tsx` | — |
| 7 | `test: add E2E tests for image optimization and content lightbox` | `e2e/` | E2E tests 1-8 |

---

## Files to Modify

```
src/models/markdown.ts                                ← MODIFY: add options parameter, optimized image renderer
src/models/markdown.test.ts                           ← MODIFY: add tests for optimizeImages
src/components/ui/image-lightbox.tsx                   ← NEW: shared lightbox component
src/components/blog/content-image-lightbox.tsx         ← NEW: zero-prop client component, DOM event delegation
src/components/blog/article-body.tsx                   ← UNCHANGED: remains pure server component
src/components/admin/media-library.tsx                 ← MODIFY: use ImageLightbox, use next/image for thumbnails
src/app/(blog)/[year]/[month]/[slug]/page.tsx         ← MODIFY: use renderMarkdown with optimizeImages, mount ContentImageLightbox
src/app/(blog)/preview/[id]/page.tsx                  ← MODIFY: use renderMarkdown with optimizeImages, mount ContentImageLightbox
src/app/globals.css                                   ← MODIFY: cursor:pointer on .blog-content img:not(a img)
e2e/browser/content-images.spec.ts                    ← NEW: E2E tests for image optimization + lightbox
```

## Verification

1. `bun run typecheck` — 0 errors
2. `bun run lint` — 0 warnings
3. `bun run test` — all pass, coverage ≥ 90%
4. `bun run test:e2e:api` — RSS feed still serves raw `<img>` URLs
5. `bun run test:e2e:browser` — content images optimized, lightbox works
6. Visual: open blog post with images → DevTools Network tab shows `/_next/image` requests
7. Visual: click inline image → lightbox opens with full-size preview
8. Visual: admin media library → lightbox still shows metadata + actions
9. Visual: admin media grid → Network shows smaller image transfers via `/_next/image`
