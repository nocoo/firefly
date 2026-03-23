# 06 — Design Review & Optimization Plan

> Design review conducted 2026-03-23 using the 12-skill design chain methodology:
> critique → frontend-design → extract → normalize → polish → adapt → harden.

---

## Executive Summary

Firefly is a WordPress-to-Next.js blog migration with two distinct surfaces: a **public blog** (CeleRev warm-paper aesthetic) and an **admin dashboard** (Basalt design system). The blog achieves a confident editorial tone; the admin is functionally complete but has rough edges. This document catalogs design issues by severity and maps each to concrete file paths and fixes.

**Overall design grade: B+** — strong foundations, needs consistency and polish passes.

---

## 1. Critique — Holistic Design Director Review

### 1.1 Priority Issues (P0)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| C-01 | **All `--radius-*` tokens are 0px** — the entire UI renders sharp rectangles including admin cards, buttons, inputs, and chart widgets. The `rounded-[var(--radius-widget)]` and `rounded-[var(--radius-card)]` classes in admin resolve to `0px`, creating a stark industrial look that contradicts the warm-paper blog aesthetic and standard dashboard expectations. | `src/app/globals.css:50-55` | Visual coherence across both surfaces |
| C-02 | **Blog and admin use separate, disconnected color systems** — Blog uses `--blog-*` hex vars while admin uses Basalt HSL tokens. The `ThemeToggle` applies `.dark` class which correctly toggles both, but there's no shared semantic layer (e.g., `--blog-accent` is `#9DBFCF` in light but accent token is `220 14% 92%` — completely different hues). | `src/app/globals.css:42-48, 97-104, 142-149` | Design system fragmentation |
| C-03 | **Featured image has no `loading`, `width`, `height`, or Next.js `<Image>`** — raw `<img>` tags with no optimization. This affects LCP, CLS, and Lighthouse scores. | `src/components/blog/post-card.tsx:42`, `src/app/(blog)/[year]/[month]/[slug]/page.tsx:139-143` | Performance + SEO |

### 1.2 Secondary Issues (P1)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| C-04 | **Sidebar fixed-left positioning uses magic number `translateX(-670px)`** — calculated from `1340px / 2` max-width. Fragile; breaks if max-width changes. Should use CSS calc or container queries. | `src/app/globals.css:565` | Maintainability |
| C-05 | **Admin `PostForm` has dead code** — `editorFields` JSX is assigned to a variable, followed by a `return` statement. The variable assignment includes a full JSX tree that's never rendered directly; the actual `return` wraps it in a form. The first "return" inside the variable (line ~395 `return ( <div className="flex gap-6">`) shadows the `editorFields` variable. | `src/components/admin/post-form.tsx:132-395` | Correctness — likely unreachable code |
| C-06 | **No loading skeleton or suspense boundary for blog pages** — SSR pages render instantly, but client-navigations show no feedback. Admin `AnalyticsDashboard` shows plain text "Loading..." instead of skeleton. | `src/components/admin/analytics-dashboard.tsx:137-141` | Perceived performance |
| C-07 | **Pagination is text-only ("← Newer" / "Older →")** — no page numbers, no total count indicator. For a 20-items-per-page blog with hundreds of posts, users have no sense of depth. | `src/components/blog/pagination.tsx` | Navigation UX |

### 1.3 Minor Observations (P2)

| # | Issue | Location |
|---|-------|----------|
| C-08 | `ThemeToggle` uses Basalt tokens (`text-muted-foreground`, `hover:bg-accent`) while sitting inside blog layout that uses `--blog-*` tokens. Visual mismatch in hover states. | `src/components/theme-toggle.tsx:83` |
| C-09 | Blog `<img>` alt text is just the post title — not descriptive. Featured images should have contextual alt or be marked decorative (`alt=""`). | `post-card.tsx:44`, `[slug]/page.tsx:141` |
| C-10 | Social link hover has `transform: translateY(-2px)` lift effect — the only animation in the entire blog. Inconsistent motion language. | `globals.css:416` |
| C-11 | Admin sidebar collapse animation (`transition-all duration-300`) animates width change which triggers layout reflow every frame. Should use `transform` or CSS `contain`. | `src/components/admin/sidebar.tsx:151` |
| C-12 | `StatCard`, `ChartCard`, `TableCard` in analytics are nearly identical wrapper components — should be unified. | `src/components/admin/analytics-dashboard.tsx:436-486` |

---

## 2. Frontend Design — Anti-Pattern Detection

### 2.1 Identified Anti-Patterns

| Pattern | Severity | Details |
|---------|----------|---------|
| **Hardcoded hex colors outside design tokens** | Medium | `CHART_COLORS` and `PIE_COLORS` in `analytics-dashboard.tsx:85-96` use raw hex (`#3b82f6`, `#10b981`) instead of CSS custom properties. Won't respond to theme changes. |
| **Inline styles for dynamic values** | Low | Tag cloud `fontSize` computed inline (`blog-sidebar.tsx:101`). Acceptable for truly dynamic values, but could use CSS clamp for accessibility. |
| **`dangerouslySetInnerHTML` for markdown** | Accepted risk | Used in post content and preview. Sanitization happens in `renderMarkdown()` — verify it uses a whitelist sanitizer. |
| **Mixed CSS methodology** | Medium | Blog uses BEM-like custom classes (`.blog-sidebar`, `.blog-entry`); admin uses Tailwind utilities exclusively. Two different styling philosophies in one app. |

### 2.2 Missing Frontend Patterns

| Pattern | Location needed |
|---------|----------------|
| **Focus-visible outlines** | All interactive elements — buttons, links, inputs. Currently no `:focus-visible` styling in globals.css or on Tailwind `focus:` states. |
| **Skip-to-content link** | `src/app/(blog)/layout.tsx` — needed for keyboard/screen-reader users. |
| **Error boundary** | No React error boundary wrapping blog or admin routes. |
| **Empty state illustrations** | Admin posts list, categories, tags pages — text-only "no items" messages. |

---

## 3. Extract — Reusable Components & Tokens

### 3.1 Components to Extract

| Component | Current locations | Proposed path |
|-----------|------------------|---------------|
| `SegmentedControl` | Analytics period selector (`analytics-dashboard.tsx:166-179`), post form write/preview tabs (`post-form.tsx:186-208`) — identical pill-toggle pattern | `src/components/ui/segmented-control.tsx` |
| `DataCard` | `StatCard` / `ChartCard` / `TableCard` — three near-identical wrappers | `src/components/ui/data-card.tsx` with `variant` prop |
| `IconButton` | Repeated `h-8 w-8 items-center justify-center rounded-lg` pattern in shell.tsx, sidebar.tsx, theme-toggle.tsx, locale-toggle.tsx | `src/components/ui/icon-button.tsx` |
| `EmptyState` | Various "no items" text spans across admin pages | `src/components/ui/empty-state.tsx` |

### 3.2 Tokens to Formalize

| Token | Current value | Recommended |
|-------|---------------|-------------|
| `--radius-card` | `0px` | `14px` (Basalt standard) |
| `--radius-widget` | `0px` | `10px` (Basalt standard) |
| `--radius-lg` | `0px` | `12px` |
| `--radius-md` | `0px` | `8px` |
| `--radius-sm` | `0px` | `6px` |
| Chart colors | Hardcoded hex | CSS custom properties: `--chart-1` through `--chart-8` |

---

## 4. Normalize — Design System Consistency

### 4.1 Token Alignment

**Problem**: The blog surface and admin surface use two completely different color systems.

**Recommendation**: Keep the blog `--blog-*` palette for editorial warmth, but express chart colors and admin accent states through the shared Basalt tokens. Specifically:

```css
/* Add to @theme inline */
--color-chart-1: hsl(var(--chart-1));
--color-chart-2: hsl(var(--chart-2));
/* ... */

:root {
  --chart-1: 217 91% 60%;   /* primary blue */
  --chart-2: 160 60% 45%;   /* emerald */
  --chart-3: 38 92% 50%;    /* amber */
  --chart-4: 0 72% 51%;     /* red */
  --chart-5: 258 90% 66%;   /* violet */
}
```

### 4.2 Typography Normalization

| Surface | Font stack | Issue |
|---------|-----------|-------|
| Blog body | System sans (`-apple-system`) | OK |
| Blog prose | `Noto Serif SC` + serif fallbacks | OK — intentional CJK editorial |
| Admin | Inherits body sans | OK but `font-family` is set on `body` in base layer AND on `.blog-shell` — redundant |

**Action**: Remove duplicate `font-family` from `.blog-shell` (line 278); the body base already covers it.

### 4.3 Spacing Audit

Admin shell inner content uses `p-3 md:p-5` with `rounded-[16px] md:rounded-[20px]` hardcoded — should use `--radius-island` token (Basalt: `20px`).

**File**: `src/components/admin/shell.tsx:140`

---

## 5. Polish — Spacing, Alignment, Consistency

### 5.1 Fixes

| # | Fix | File | Change |
|---|-----|------|--------|
| P-01 | Set proper radius tokens | `globals.css:50-55` | `--radius-card: 14px; --radius-widget: 10px; --radius-lg: 12px; --radius-md: 8px; --radius-sm: 6px;` |
| P-02 | Replace raw `<img>` with Next.js `<Image>` for featured images | `post-card.tsx`, `[slug]/page.tsx` | Import `Image` from `next/image`, add `width`, `height`, `loading="lazy"` |
| P-03 | Add `loading="lazy"` to all blog images in prose content | `models/markdown.ts` | Configure marked renderer to add `loading="lazy"` to `<img>` tags |
| P-04 | Unify card wrappers in analytics dashboard | `analytics-dashboard.tsx` | Replace `StatCard`/`ChartCard`/`TableCard` with single `DataCard` |
| P-05 | Add focus-visible ring to all interactive elements | `globals.css` base layer | `*:focus-visible { outline: 2px solid hsl(var(--ring)); outline-offset: 2px; }` |
| P-06 | Add skip-to-content link | `src/app/(blog)/layout.tsx` | `<a href="#main" className="sr-only focus:not-sr-only ...">Skip to content</a>` and `id="main"` on `<main>` |
| P-07 | Loading skeletons for admin dashboard | `analytics-dashboard.tsx` | Replace text "Loading..." with animated skeleton cards |

### 5.2 Quick Wins (< 30 min each)

1. **Restore Basalt radius tokens** — single file change, instant visual upgrade across admin
2. **Focus-visible outlines** — 3 lines of CSS, major a11y win
3. **Skip-to-content link** — 5 lines of JSX
4. **Remove duplicate font-family** from `.blog-shell`

---

## 6. Adapt — Responsive & Cross-Device

### 6.1 Current Breakpoints

| Breakpoint | Value | Surface |
|------------|-------|---------|
| Mobile max | `56.24em` (899px) | Blog sidebar stacks above |
| Tablet | `37.5em–56.24em` | Blog intermediate |
| Desktop | `56.25em+` (900px) | Blog sidebar fixed left |
| Admin mobile | `useIsMobile()` hook | Overlay sidebar drawer |
| Admin tablet | — | **Missing** — no intermediate breakpoint |

### 6.2 Issues

| # | Issue | Recommendation |
|---|-------|---------------|
| A-01 | Admin has no tablet breakpoint — jumps from full sidebar to mobile overlay. iPad landscape (1024px) shows full sidebar but content area is cramped. | Add collapsed sidebar as default for `md` (768-1024px) range. |
| A-02 | Blog `max-width: 1340px` is generous. On exactly 900px-wide screens, sidebar is 25% = 225px, too narrow for Chinese category names. | Test with actual CJK content; consider bumping sidebar to 28% below 62.5em. |
| A-03 | Featured image bleed (`margin-left: calc(-1 * var(--blog-main-px) - 3em)`) doesn't account for very wide screens where bleed might extend under sidebar. | Add `max-width` constraint or clip via `overflow: hidden` on `.blog-main`. |

---

## 7. Harden — Error Handling & Edge Cases

### 7.1 Issues

| # | Issue | File | Fix |
|---|-------|------|-----|
| H-01 | `PostForm` uses `confirm()` for delete — no accessible alternative for screen readers | `post-form.tsx:71` | Replace with modal dialog component |
| H-02 | Analytics fetch error shows raw error message — may leak internal details | `analytics-dashboard.tsx:126` | Sanitize error messages; show generic user-facing text |
| H-03 | No `<noscript>` fallback — blog is SSR so mostly fine, but theme toggle and locale toggle silently vanish | `layout.tsx` | Add `<noscript>` explaining JS requirement for toggles |
| H-04 | Comment content rendered as plain text (`{comment.content}`) — safe, but means no markdown in comments. Intentional? | `comments.tsx:39-41` | Document the decision; consider basic markdown support |
| H-05 | Tag cloud min font size `0.75em` may be too small for readability on mobile | `blog-sidebar.tsx:91` | Bump minimum to `0.8125em` (13px at 16px base) |

---

## 8. Implementation Priority

### Phase 1 — Quick Wins (1-2 hours)

| Task | Files | Est. |
|------|-------|------|
| Restore Basalt radius tokens to non-zero values | `globals.css` | 10 min |
| Add focus-visible global outline | `globals.css` | 5 min |
| Add skip-to-content link | `(blog)/layout.tsx` | 10 min |
| Remove duplicate font-family from `.blog-shell` | `globals.css` | 2 min |
| Bump tag cloud min font size | `blog-sidebar.tsx` | 2 min |
| Add `loading="lazy"` to featured images | `post-card.tsx`, `[slug]/page.tsx` | 10 min |

### Phase 2 — Component Extraction (2-3 hours)

| Task | Files | Est. |
|------|-------|------|
| Extract `IconButton` component | New `ui/icon-button.tsx` + refactor 4 files | 30 min |
| Extract `SegmentedControl` component | New `ui/segmented-control.tsx` + refactor 2 files | 30 min |
| Unify `DataCard` from three analytics wrappers | `analytics-dashboard.tsx` | 20 min |
| Extract `EmptyState` component | New `ui/empty-state.tsx` + refactor admin pages | 20 min |

### Phase 3 — Image Optimization (1-2 hours)

| Task | Files | Est. |
|------|-------|------|
| Replace `<img>` with Next.js `<Image>` for featured images | `post-card.tsx`, `[slug]/page.tsx` | 45 min |
| Add lazy loading to markdown-rendered images | `models/markdown.ts` | 30 min |

### Phase 4 — Responsive Polish (2-3 hours)

| Task | Files | Est. |
|------|-------|------|
| Add admin tablet breakpoint (auto-collapse sidebar) | `shell.tsx`, `sidebar.tsx` | 1 hour |
| Refactor sidebar `translateX` magic number to CSS calc | `globals.css` | 30 min |
| Constrain featured image bleed on wide screens | `globals.css` | 20 min |

### Phase 5 — Design Token Unification (1-2 hours)

| Task | Files | Est. |
|------|-------|------|
| Add chart color CSS custom properties | `globals.css` | 15 min |
| Migrate hardcoded hex colors in analytics to tokens | `analytics-dashboard.tsx` | 30 min |
| Formalize blog ↔ admin color mapping documentation | This doc | 30 min |

---

## Atomic Commit Plan

Each phase should be committed independently:

```
feat: restore basalt radius tokens and add focus-visible outlines
feat: add skip-to-content link and a11y improvements
refactor: extract icon-button, segmented-control, data-card components
feat: replace raw img with next/image for featured images
fix: add admin tablet breakpoint and refactor sidebar positioning
refactor: unify chart colors under CSS custom properties
```

---

## References

- Basalt Design System tokens: `search-memory "basalt design system"`
- Dashboard design conventions: `search-memory "dashboard 设计规范"`
- 12-skill design chain: critique → frontend-design → extract → normalize → polish → adapt → harden
