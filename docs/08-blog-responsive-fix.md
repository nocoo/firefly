# 08 — Blog Sidebar Responsive Layout Fix

## Problem

Blog sidebar layout breaks at viewport widths below ~1340px. Three structural issues:

### 1. Breakpoint inconsistency

`blog-layout-client.tsx:22` uses `useIsMobile()` (< 768px) to toggle desktop/drawer, but the desktop CSS layout (`globals.css:306`) depends on `--blog-max-width: 1340px`. The 768–1340px range is a dead zone with no valid layout state.

### 2. Fixed canvas positioning

`globals.css:319` `.blog-sidebar-desktop` uses `position: fixed; left: 50%; transform: translateX(-670px)` — anchored to a virtual 1340px canvas. When viewport < 1340px, sidebar left edge = `viewport/2 - 670`, going off-screen:

| Viewport | Sidebar left edge | Result |
|----------|-------------------|--------|
| 1340px | 0px | Correct |
| 1000px | -170px | Partially hidden |
| 768px | -286px | Invisible |

### 3. Rigid main area

`globals.css:338` `.blog-main-desktop` hardcodes `margin-left: 25%; width: 75%` — even when sidebar is off-screen, main won't reclaim the space.

## Design Decision

**CSS-driven two-phase responsive layout.** No JS breakpoint hooks for layout switching.

- **≥ 1200px** — Desktop two-column: grid + sticky sidebar
- **< 1200px** — Drawer mode: sidebar hidden, hamburger + slide-in drawer

Breakpoint rationale: 1200px is a common blog layout threshold — below it a 25% sidebar (~300px at 1200px) becomes too cramped for categories, tag cloud, and archives. This is a standard content-site breakpoint, not tied to any observed bug threshold.

### Principles

1. **CSS owns layout** — media queries decide desktop vs drawer. No `useIsMobile()` / `useBlogDesktop()` for layout decisions. SSR renders both desktop sidebar and drawer elements; CSS hides the inactive one. Zero hydration mismatch.
2. **JS owns interaction only** — React state controls drawer open/close and scroll lock. Nothing more.
3. **Single source of truth** — one breakpoint in CSS, no parallel JS breakpoint.
4. **Drawer state converges on layout change** — when viewport crosses into desktop range while drawer is open, drawer must auto-close. Backdrop and scroll lock must not leak into desktop mode.
5. **Drawer is inert when inactive** — closed drawer and desktop-hidden drawer must be inaccessible: no tab focus, no screen reader traversal, no pointer events. Use `inert` attribute (natively supported) rather than relying on off-screen transform alone.
6. **Consolidate duplicated logic** — backdrop rendering and `body.style.overflow` lock exist in both `blog-layout-client.tsx` and `blog-sidebar.tsx`. Consolidate to one owner.

## Implementation

### Step 1: CSS — Replace fixed sidebar with grid + sticky + media query

**File**: `src/app/globals.css`

#### 1a. Desktop two-column grid on `.blog-max-width`

```css
.blog-max-width {
  --blog-max-width: 1340px;
  max-width: var(--blog-max-width);
  margin: 0 auto;
}

@media (min-width: 1200px) {
  .blog-max-width {
    display: grid;
    grid-template-columns: 25% 1fr;
  }
}
```

#### 1b. Desktop sidebar — sticky instead of fixed

Replace `.blog-sidebar-desktop` entirely:

```css
/* Desktop sidebar — visible only >= 1200px via media query */
.blog-sidebar-desktop {
  display: none;  /* hidden by default (drawer mode) */
}

@media (min-width: 1200px) {
  .blog-sidebar-desktop {
    display: block;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    padding: 2.5em 2em;
    z-index: 9;
    border-right: 1px solid var(--blog-separator);
  }
}
```

Removed: `position: fixed`, `left: 50%`, `transform: translateX(...)`, `width: 25%`, `max-width: calc(...)`. Grid handles sizing.

#### 1c. Main content — remove `-desktop` / `-mobile` class split

Delete `.blog-main-desktop` and `.blog-main-mobile` entirely. The single `.blog-main` class (see 1e) handles both modes via media query. Add `overflow-x: clip` and `min-height: 100vh` to `.blog-main` directly:

```css
.blog-main {
  background: var(--blog-surface);
  margin: 0 auto;
  --blog-main-px: 6%;
  padding: 2em var(--blog-main-px);
  position: relative;
  min-height: 100vh;
  overflow-x: clip;
}
```

Removed classes: `.blog-main-desktop` (with its `margin-left: 25% !important`, `width: 75% !important`), `.blog-main-mobile` (with its `width: 100% !important`).

#### 1d. Mobile bar — CSS visibility

```css
.blog-mobile-bar {
  position: fixed;
  top: 0.75em;
  left: 0.75em;
  z-index: 21;
  display: block;  /* visible by default (drawer mode) */
}

@media (min-width: 1200px) {
  .blog-mobile-bar {
    display: none;  /* hidden in desktop mode */
  }
}
```

#### 1e. Main padding — media query on the single `.blog-main` class

The padding values from the deleted `-mobile` class are now a media query on `.blog-main`:

```css
@media (max-width: 1199px) {
  .blog-main {
    padding: 3.5em 5% 2em;
  }
}
```

#### 1f. Featured image bleed — scoped to desktop media query

```css
@media (min-width: 1200px) {
  .blog-main .blog-featured-image {
    margin-left: calc(-1 * var(--blog-main-px, 6%) - 3em);
    margin-right: 0;
  }
}
```

### Step 2: Simplify React components — remove JS layout branching

**File**: `src/components/blog/blog-layout-client.tsx`

Before: conditionally renders desktop sidebar OR mobile hamburger+overlay based on `useIsMobile()`.
After: always renders both; CSS controls visibility. JS handles drawer interaction + state convergence.

```tsx
const DESKTOP_QUERY = "(min-width: 1200px)";

export function BlogLayoutClient({ categories, tags, archives, locale, children }: BlogLayoutClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // State convergence: auto-close drawer when entering desktop layout.
  // This is not a layout decision — CSS already hides the drawer at >= 1200px.
  // This cleans up React state so backdrop and scroll-lock don't leak.
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setDrawerOpen(false);
    };
    // Close immediately if already in desktop range (e.g. SSR hydration on wide screen)
    if (mql.matches) setDrawerOpen(false);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Scroll lock — single owner
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  return (
    <>
      {/* Desktop sidebar — always in DOM, CSS shows/hides via media query */}
      <BlogSidebar variant="desktop" categories={categories} tags={tags} archives={archives} />

      {/* Mobile hamburger — always in DOM, CSS shows/hides via media query */}
      <div className="blog-mobile-bar">
        <IconButton onClick={() => setDrawerOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </IconButton>
      </div>

      {/* Drawer overlay — rendered when open */}
      {drawerOpen && (
        <div className="blog-sidebar-backdrop" onClick={() => setDrawerOpen(false)} />
      )}
      <BlogSidebar
        variant="drawer"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        categories={categories}
        tags={tags}
        archives={archives}
      />

      <main id="main" className="blog-main">
        {children}
        <BlogFooter locale={locale} />
      </main>
    </>
  );
}
```

Key changes:
- Remove `useIsMobile()` import — no JS breakpoint hook for layout
- `matchMedia` listener auto-closes drawer on desktop transition (state convergence, not layout decision)
- Always render desktop sidebar + hamburger + drawer sidebar in DOM
- CSS media queries handle visibility
- `blog-main` no longer needs `-desktop` or `-mobile` suffix classes
- Scroll lock only in this component (removed from `BlogSidebar`)
- Backdrop only rendered here (removed from `BlogSidebar`)

**File**: `src/components/blog/blog-sidebar.tsx`

Simplify props — replace `isMobile`/`isMobileOpen` with `variant` + `open`:

```tsx
interface BlogSidebarProps {
  variant: "desktop" | "drawer";
  open?: boolean;       // only meaningful for drawer
  onClose?: () => void; // only meaningful for drawer
  categories: Category[];
  tags: Tag[];
  archives: MonthlyArchive[];
}
```

The `<aside>` element uses the `inert` attribute to ensure inactive sidebars are fully inaccessible:

```tsx
<aside
  className={`blog-sidebar ${variant === "desktop" ? "blog-sidebar-desktop" : "blog-sidebar-drawer"} ${variant === "drawer" && open ? "blog-sidebar-drawer-open" : ""}`}
  // Desktop sidebar: inert below 1200px (hidden by CSS display:none, inert is belt-and-suspenders)
  // Drawer sidebar: inert when closed
  inert={variant === "drawer" && !open ? true : undefined}
  aria-hidden={variant === "drawer" && !open ? true : undefined}
>
```

For the desktop variant, CSS `display: none` below 1200px already removes it from accessibility tree and tab order — no extra attribute needed. For the drawer variant, `inert` + `aria-hidden` when closed ensures:
- No tab focus into off-screen drawer links
- Screen readers skip the closed drawer entirely
- No pointer events leak through the transform-hidden element

Note: `inert` is natively supported in all modern browsers. React 19+ / `@types/react` 19+ includes `inert` in JSX typings. If the project's React or type version doesn't recognize `inert` as a valid prop, suppress with `// @ts-expect-error inert not yet in typings` or extend `HTMLAttributes` locally.

Changes:
- Remove `isMobile` / `isMobileOpen` props
- Remove duplicate `useEffect` for `body.style.overflow` (moved to parent)
- Remove duplicate backdrop rendering (moved to parent)
- Use `variant` to pick CSS class: `blog-sidebar-desktop` or `blog-sidebar-drawer`
- Drawer uses `open` prop to toggle `blog-sidebar-drawer-open` class
- `inert` + `aria-hidden` on closed drawer for accessibility

### Step 3: Server layout stays unchanged

**File**: `src/app/(blog)/layout.tsx` — **no changes needed**.

`blog-max-width` wrapper stays in server layout. The grid is activated by CSS media query, not by JS. This is important: the server can render the full DOM tree, and CSS handles the rest.

### Step 4: Rename CSS classes for clarity

| Old class | New class | Reason |
|-----------|-----------|--------|
| `blog-sidebar-mobile` | `blog-sidebar-drawer` | Not tied to "mobile" — it's the drawer variant |
| `blog-sidebar-mobile-open` | `blog-sidebar-drawer-open` | Consistency |
| `blog-main-mobile` | _(deleted)_ | Merged into single `.blog-main` + media query |
| `blog-main-desktop` | _(deleted)_ | Merged into single `.blog-main`, grid handles layout |

## Files changed

| File | Change |
|------|--------|
| `src/app/globals.css` | Sidebar: fixed → grid+sticky. Media queries at 1200px. Remove `-mobile`/`-desktop` class split for main. Rename drawer classes. |
| `src/components/blog/blog-layout-client.tsx` | Remove `useIsMobile()`. Always render both sidebar variants. Consolidate scroll lock + backdrop here. |
| `src/components/blog/blog-sidebar.tsx` | Simplify props to `variant`/`open`/`onClose`. Remove duplicate scroll lock + backdrop. |
| `src/app/(blog)/layout.tsx` | No changes. |

## Atomic commits

1. `refactor: replace blog fixed sidebar with grid+sticky and CSS media queries`
   — CSS changes: grid on container, sticky sidebar, media query at 1200px, rename drawer classes
2. `refactor: remove JS layout branching from blog components`
   — React changes: remove `useIsMobile()`, always render both variants, consolidate drawer logic
3. `refactor: consolidate backdrop and scroll-lock to single owner`
   — Remove duplicate `body.style.overflow` from `BlogSidebar`, remove duplicate backdrop rendering

(Commits 2 and 3 can be combined if the diff is small enough.)

## Verification

1. `npm run dev` → open blog
2. Resize viewport from 1500px → 600px:
   - **≥ 1200px**: two-column grid, sidebar sticky on left, main fills right
   - **< 1200px**: sidebar hidden, hamburger visible, main full-width
3. Click hamburger → drawer slides in, backdrop appears, body scroll locked
4. Close drawer → backdrop fades, scroll restored
5. **State convergence**: open drawer at < 1200px, then drag viewport to ≥ 1200px → drawer auto-closes, backdrop gone, scroll restored, desktop sidebar visible
6. **Accessibility (closed drawer)**: at < 1200px with drawer closed, Tab through the page → no focus enters the off-screen drawer links. Verify with screen reader or DOM inspector that drawer has `inert` + `aria-hidden`.
7. **Accessibility (desktop hidden drawer)**: at ≥ 1200px, Tab through the page → drawer sidebar is `display: none`, desktop sidebar is navigable
8. View page source (SSR output) — both sidebar variants present in HTML, no hydration mismatch
9. Scroll long page at desktop width — sidebar stays sticky
10. Featured image bleed correct at desktop width
11. Dark mode unaffected
12. Admin layout unaffected
