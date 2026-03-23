# Firefly Blog Admin UI → Basalt Design System Redesign

## Executive Summary

Redesign Firefly's admin UI to strictly follow the Basalt design system. Six files need changes, one new file needs creation. The plan is ordered by dependency: foundational tokens → shared components → layout shell → pages.

---

## Gap Analysis (Firefly current vs Basalt reference)

| Area | Firefly Current | Basalt Target | Delta |
|------|----------------|---------------|-------|
| **globals.css** | Missing `font-family` on body, no `font-display` utility, no sidebar tokens, no `tw-animate-css` import | Inter body + DM Sans display, sidebar color tokens, `@utility font-display` | Medium |
| **ThemeToggle** | Text symbols ☀/●/☾, hardcoded `text-gray-500 dark:text-gray-400`, no button container sizing | Lucide icons Sun/Moon/Monitor, `h-8 w-8 rounded-lg` button with token colors | Full rewrite |
| **Root layout** | ThemeToggle floating `fixed top-4 right-4 z-50` globally — conflicts with admin header | ThemeToggle should only appear in admin header (and login page) | Structural change |
| **Login page** | Gradient blobs ✓, logo icon ✓, card uses basalt tokens ✓, Google-only button ✓ | Match is close but: Card title wording, button `rounded-widget` already correct, missing `Lock` icon import (uses custom SVG) | Minor polish |
| **AdminShell (shell.tsx)** | Header right side is empty `{/* ThemeToggle provided by root layout */}`, no GitHub link | Basalt header has GitHub icon + ThemeToggle in `gap-1` flex row | Add controls |
| **Sidebar** | Flat list (no groups), no search bar, no version badge, no nav group labels, no collapsible groups | Basalt has collapsible NavGroups with labels, search bar ⌘K, version badge | Significant enhancement |
| **Dashboard page** | StatCard uses `bg-secondary` — matches L2 ✓, but missing icon, thin styling | Currently acceptable, minor refinement possible | Minor |

---

## Implementation Plan

### Step 0: Preparation (read-only verification)
- Confirm lucide-react has `Sun`, `Moon`, `Monitor`, `Lock`, `Github` icons (it does — version 0.577.0)
- Confirm `class-variance-authority` is installed (it is)
- No new npm packages needed

---

### Step 1: `src/app/globals.css` — Add missing basalt tokens
**Commit: `fix: align globals.css with basalt design tokens`**

Changes needed:
1. Add `font-family: "Inter", system-ui, -apple-system, sans-serif;` to the `body` rule in `@layer base`
2. Add `@utility font-display { font-family: "DM Sans", system-ui, sans-serif; }` after the `@layer base` block
3. Add sidebar color tokens to both `:root` and `.dark` blocks (copy from basalt):
   - `:root`: `--sidebar-background`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`
   - `.dark`: same set with dark values
4. Add corresponding `--color-sidebar-*` mappings in `@theme inline` block (8 entries)

**Why sidebar tokens?** Even though the current sidebar uses `bg-background` directly, having the tokens allows future sidebar theming and matches basalt's token layer.

**Font loading note**: Inter and DM Sans must be available. Options:
- (a) Add Google Fonts `<link>` in `layout.tsx` `<head>`
- (b) Use `next/font/google` (preferred for Next.js — self-hosted, no layout shift)
- Recommendation: Use `next/font/google` in root layout for both Inter and DM Sans

**Verification**: `npm run dev`, inspect `<body>` computed font-family shows Inter. Toggle dark mode — sidebar tokens resolve correctly.

---

### Step 2: `src/components/theme-toggle.tsx` — Full rewrite
**Commit: `fix: rewrite theme toggle to use lucide icons and basalt styling`**

The current implementation has two problems:
1. Uses text characters (☀/●/☾) instead of Lucide icons
2. Uses hardcoded `text-gray-500 dark:text-gray-400` instead of design tokens

Rewrite to match **Pew's pattern** (most appropriate for Next.js App Router with `useSyncExternalStore`):

```tsx
"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";

const THEME_CHANGE_EVENT = "theme-change";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem("theme") as Theme) || "system";
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const applied = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", applied === "dark");
  localStorage.setItem("theme", theme);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

function subscribeToTheme(callback: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (getStoredTheme() === "system") applyTheme("system");
    callback();
  };
  mq.addEventListener("change", handler);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    mq.removeEventListener("change", handler);
  };
}

function getSnapshot(): Theme { return getStoredTheme(); }
function getServerSnapshot(): Theme { return "system"; }

const ICON_PROPS = { className: "h-4 w-4", "aria-hidden": true as const, strokeWidth: 1.5 };

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getSnapshot, getServerSnapshot);

  const cycleTheme = useCallback(() => {
    const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    applyTheme(next);
  }, [theme]);

  return (
    <button
      onClick={cycleTheme}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      aria-label={`Toggle theme (current: ${theme})`}
    >
      {theme === "system" ? <Monitor {...ICON_PROPS} /> : theme === "dark" ? <Moon {...ICON_PROPS} /> : <Sun {...ICON_PROPS} />}
    </button>
  );
}
```

Key changes vs current:
- `useSyncExternalStore` instead of `useState` + `useEffect` (cleaner, no hydration mismatch risk)
- Custom event `THEME_CHANGE_EVENT` for cross-component reactivity (Pew pattern)
- Lucide `Sun/Moon/Monitor` icons instead of text characters
- Button styled as `h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent` (matches basalt's header icon button pattern exactly)
- Removed `useEffect` + `useState` in favor of pure external store

**Verification**: Click toggle cycles through Sun→Moon→Monitor icons. Colors use design tokens (not hardcoded gray). Button is 32×32 with proper hover state.

---

### Step 3: `src/app/layout.tsx` — Remove global floating ThemeToggle, add fonts
**Commit: `refactor: move theme toggle from root layout to admin header`**

Current problem: ThemeToggle is rendered `fixed top-4 right-4 z-50` in root layout, meaning it appears on ALL pages (blog public pages, login, admin) and overlaps with the admin header's right-side controls.

Changes:
1. Remove the `import { ThemeToggle }` and the `<div className="fixed top-4 right-4 z-50"><ThemeToggle /></div>` from root layout
2. Add `next/font/google` imports for Inter and DM Sans:
   ```tsx
   import { Inter, DM_Sans } from "next/font/google";

   const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
   const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-display", weight: ["400", "500", "600", "700"] });
   ```
3. Apply font variables to `<html>`:
   ```tsx
   <html lang="zh-CN" className={`${inter.variable} ${dmSans.variable}`} suppressHydrationWarning>
   ```
4. Update `globals.css` body rule to use CSS variable:
   ```css
   body {
     @apply bg-background text-foreground;
     font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
   }
   ```
   And the `@utility font-display` rule:
   ```css
   @utility font-display {
     font-family: var(--font-display), system-ui, sans-serif;
   }
   ```

**Why remove from root layout?** The ThemeToggle will be placed in:
- Admin header (Step 4) — where basalt puts it
- Login page (Step 6) — top-right corner, like Pew does
- Blog public pages don't need it (or can add later separately)

**Verification**: `npm run dev` → Visit `/admin` — no floating toggle in top-right. Visit `/login` — no floating toggle. Inspect body — Inter font loads.

---

### Step 4: `src/components/admin/shell.tsx` — Add header right-side controls
**Commit: `feat: add github link and theme toggle to admin header`**

Changes to the header section:
1. Import `Github` from lucide-react and `ThemeToggle` from `@/components/theme-toggle`
2. Replace the empty `<div className="flex items-center gap-1">` comment with actual controls:

```tsx
<div className="flex items-center gap-1">
  <a
    href="https://github.com/nocoo/firefly"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="GitHub repository"
    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
  >
    <Github className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={1.5} />
  </a>
  <ThemeToggle />
</div>
```

This exactly matches basalt's `DashboardLayout` header right-side pattern:
- `flex items-center gap-1`
- Icon buttons: `h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent`
- GitHub icon: `h-[18px] w-[18px]` with `strokeWidth={1.5}`

Note: Basalt also has `LanguageToggle` — Firefly doesn't need i18n, so we skip that.

**Verification**: Admin page shows GitHub icon + theme toggle in header right. Both are 32×32, evenly spaced with `gap-1`. Hover states work.

---

### Step 5: `src/components/admin/sidebar.tsx` — Basalt sidebar styling with nav groups
**Commit: `feat: add nav group labels and version badge to sidebar`**

This is the largest change. The sidebar needs:

#### 5a. Add nav groups with labels

Restructure `NAV_ITEMS` from flat array to grouped:

```tsx
interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "OVERVIEW",
    items: [
      { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { title: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "CONTENT",
    items: [
      { title: "Posts", href: "/admin/posts", icon: FileText },
      { title: "Categories", href: "/admin/categories", icon: FolderOpen },
      { title: "Tags", href: "/admin/tags", icon: Tags },
    ],
  },
];
```

#### 5b. Add collapsible group sections (expanded view)

Add a `NavGroupSection` component matching basalt's pattern:
- Collapsible trigger with group label + chevron
- `grid-template-rows` CSS transition for smooth expand/collapse
- Import `ChevronUp` from lucide-react
- Group label styling: `text-sm font-normal text-muted-foreground` (basalt) or `text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70` (pew style)

**Decision point**: Basalt uses `text-sm font-normal` for group labels, Pew uses `text-[11px] uppercase tracking-wider`. Recommend **Pew's style** — it's more standard for sidebar nav group labels and provides better visual hierarchy.

The collapsible component needs `@radix-ui/react-collapsible`. Check if it exists:
- **Not in package.json** — needs `npm install @radix-ui/react-collapsible`
- Alternative: skip radix, use plain state + CSS grid transition (simpler, no new dep)
- **Recommendation**: Use plain state + CSS grid (matching basalt's actual DOM pattern which just uses `Collapsible` from shadcn, but we can replicate the behavior without the radix dep)

#### 5c. Add version badge to expanded header

```tsx
<span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground leading-none">
  v0.1.0
</span>
```

Import version from `package.json` or hardcode. For simplicity, hardcode initially.

#### 5d. Collapsed view updates

In collapsed view, flatten all nav group items (same as current, but sourced from `NAV_GROUPS.flatMap(g => g.items)`).

#### 5e. Complete sidebar structure (expanded view)

```
├── Header (logo + "Firefly" + version badge + collapse button)
├── Nav groups (collapsible, with labels)
│   ├── OVERVIEW
│   │   ├── Dashboard
│   │   └── Analytics
│   └── CONTENT
│       ├── Posts
│       ├── Categories
│       └── Tags
└── User footer (avatar + name + email + logout)
```

**No search bar**: Firefly only has 5 nav items — search bar is unnecessary overhead. Basalt has it because it has 20+ items. Skip this.

**Verification**: 
- Expanded: Group labels visible ("OVERVIEW", "CONTENT"), items underneath, chevrons toggle collapse
- Collapsed: All 5 icons visible in flat list
- Active states: `bg-accent text-foreground`
- Hover: `hover:bg-accent hover:text-foreground`

---

### Step 6: `src/app/login/page.tsx` + `src/components/auth/login-card.tsx` — Complete login redesign
**Commit: `feat: redesign login page to match basalt design`**

The current login page is already close but needs these fixes:

#### 6a. `login/page.tsx` changes:

1. Import `Lock` from lucide-react instead of custom SVG for the logo icon:
   ```tsx
   <Lock className="h-5 w-5 text-primary-foreground" strokeWidth={1.5} />
   ```
   Replace the 3-path SVG with the Lucide Lock icon.

2. The logo container already uses `rounded-[var(--radius-card)]` — change to Tailwind's `rounded-card` if the token is registered. Looking at globals.css, `--radius-card: 14px` is defined in `@theme inline`, so `rounded-card` should work as a Tailwind class. **Verify this works in Tailwind v4** — in v4, `@theme inline` registers `--radius-card` which enables `rounded-card`. ✓

3. Add ThemeToggle to login page top-right (Pew pattern):
   ```tsx
   import { ThemeToggle } from "@/components/theme-toggle";
   
   // Inside the component, before the centered content:
   <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
     <ThemeToggle />
   </div>
   ```

4. Change the outer `<div>` to `relative` to properly position the absolute toggle:
   ```tsx
   <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
   ```

#### 6b. `login-card.tsx` changes:

The card component is already well-structured. Minor fixes:
1. Card already uses `rounded-[var(--radius-card)] border-0 bg-card shadow-none` ✓
2. Google button already uses `rounded-[var(--radius-widget)] bg-secondary` ✓  
3. Google SVG uses colored fills (multi-color Google logo) — this is correct and matches basalt's social buttons

No significant changes needed to login-card.tsx. It already follows basalt patterns.

**Verification**: Login page shows Lock icon (not layers SVG), ThemeToggle in top-right, card styling matches basalt.

---

### Step 7: `src/app/admin/page.tsx` — Dashboard stat cards (minor)
**Commit: `fix: refine dashboard stat cards`**

Current stat cards use `bg-secondary` which is correct (L2 layer). The styling is already minimal and correct. No major changes needed.

Optional polish (if desired):
- Add an icon to each stat card
- Add trend indicator

**Recommendation**: Skip for now — the stat cards already follow basalt tokens correctly. The `bg-secondary` + `rounded-[var(--radius-widget)]` + `text-muted-foreground` / `text-foreground` pattern is exactly basalt.

**Verification**: Dashboard stat cards render with correct L2 background, proper radius, proper text colors.

---

## Execution Order Summary

```
Step 1: globals.css (tokens foundation)
  ↓
Step 2: theme-toggle.tsx (shared component, no deps on step 1)
  ↓
Step 3: layout.tsx (depends on step 2 — removes old toggle, adds fonts)
  ↓
Step 4: shell.tsx (depends on step 2 — imports new ThemeToggle)
  ↓
Step 5: sidebar.tsx (independent, largest change)
  ↓
Step 6: login page (depends on step 2 for ThemeToggle, step 3 for no global toggle)
  ↓
Step 7: dashboard page (minor, independent)
```

Steps 1 and 2 can be done in parallel.
Steps 4 and 5 can be done in parallel (both depend on step 3).
Step 7 is optional and independent.

---

## Files Changed

| # | File | Action | Size of Change |
|---|------|--------|----------------|
| 1 | `src/app/globals.css` | Edit | Small — add font rules + sidebar tokens |
| 2 | `src/components/theme-toggle.tsx` | **Full rewrite** | Medium — ~60 lines |
| 3 | `src/app/layout.tsx` | Edit | Small — remove floating toggle, add font imports |
| 4 | `src/components/admin/shell.tsx` | Edit | Small — add GitHub + ThemeToggle to header |
| 5 | `src/components/admin/sidebar.tsx` | **Major rewrite** | Large — nav groups, collapsible, version badge |
| 6 | `src/app/login/page.tsx` | Edit | Small — Lock icon, ThemeToggle, `relative` wrapper |
| 7 | `src/app/admin/page.tsx` | Skip | No changes needed — already correct |

## New Dependencies
- None required (can implement collapsible with plain state + CSS grid)
- **Optional**: `@radix-ui/react-collapsible` for cleaner Collapsible API (basalt/pew both use it)

## Risks & Decisions

1. **Font loading**: Using `next/font/google` is the Next.js recommended approach. If Inter/DM Sans CDN is blocked in some regions, the fallback `system-ui` will apply gracefully.

2. **No search bar in sidebar**: Intentional — 5 nav items don't warrant it. Can add later if more pages are added.

3. **Global ThemeToggle removal**: Currently the toggle appears on public blog pages too. After Step 3, it won't appear on public pages. If this is undesired, we can add it back to specific public layouts separately.

4. **GitHub URL**: Using `https://github.com/nocoo/firefly` — confirm this is the correct repo URL.
