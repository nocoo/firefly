# 10 — Image Upload System

Complete image upload functionality for the blog admin, covering site logo upload (settings page) and post image upload (post editor). All images are stored in Cloudflare R2.

## Current State

### What Exists

- **R2 client** (`src/lib/r2-client.ts`): S3Client singleton, `uploadToR2()`, `deleteFromR2()`. All uploads set `Cache-Control: public, max-age=31536000, immutable`
- **R2 validation** (`src/lib/r2.ts`): magic-byte detection, MIME allowlist (no SVG), size limit (10 MB), key generation (`uploads/YYYY/MM/timestamp-filename`)
- **Upload API** (`src/app/api/upload/route.ts`): `POST /api/upload`, multipart form-data → R2
- **ImageUpload component** (`src/components/admin/image-upload.tsx`): click + drag-drop, calls `/api/upload`, returns URL via `onUpload` callback. Note: front-end `accept` attribute includes `image/svg+xml` but server rejects SVG — this inconsistency will be fixed in this iteration
- **PostForm** (`src/components/admin/post-form.tsx`): uses `ImageUpload` for content images (appends `![](url)` to markdown); featured image is a plain `<input type="url">` with no upload capability
- **Settings page** (`src/components/admin/settings-form.tsx`): 4 fields (locale, postsPerPage, commentsEnabled, fontStyle) — no logo/image field
- **Favicon**: static `src/app/favicon.ico`, no dynamic override
- **Login page** (`src/components/auth/login-card.tsx`): uses static `/logo-24.png` (header bar) and `/logo-80.png` (center avatar)
- **Blog sidebar** (`src/components/blog/blog-sidebar.tsx`): text-only site name "LIZHENG.ME", no logo image
- **Site settings DB** (`site_settings`): no logo column. Has 5-minute process-level cache (`src/data/settings.ts:42`)

### R2 Configuration

| Item | Value |
|------|-------|
| Bucket | `lizhengblog` |
| Upload path prefix | `lizhengblog/wp-content/uploads/firefly/` |
| File naming | GUID (e.g. `a1b2c3d4-e5f6-7890-abcd-ef1234567890.png`) |
| CDN prefix | `https://assets.lizheng.me` |
| Env vars | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CF_ACCOUNT_ID` |

### Key Difference from Current Upload Logic

Current `generateR2Key()` produces `uploads/YYYY/MM/timestamp-filename`. The new behavior requires:
- **Path prefix**: `lizhengblog/wp-content/uploads/firefly/`
- **File naming**: GUID-based (e.g. `{uuid}.{ext}`)
- **Full key example**: `lizhengblog/wp-content/uploads/firefly/a1b2c3d4.png`

---

## Feature 1: Site Logo Upload (Settings Page)

### Behavior

1. User uploads an image on the settings page
2. Server validates: must be an image, aspect ratio must be 1:1 (strict — reject if `width !== height`, no auto-crop, no tolerance). Front-end shows hint text upfront; server returns clear error if non-square
3. Server resizes to multiple sizes using `sharp`:
   - `logo-16.png` — favicon 16×16
   - `logo-32.png` — favicon 32×32
   - `logo-48.png` — favicon 48×48
   - `logo-80.png` — login page center avatar
   - `logo-180.png` — Apple touch icon 180×180
   - `logo-192.png` — PWA icon 192×192
   - `logo-512.png` — PWA icon 512×512
4. All variants uploaded to R2 under a **versioned path**: `lizhengblog/wp-content/uploads/firefly/site/<version>/logo-{size}.png`
5. `<version>` is a short hash derived from `crypto.randomUUID().slice(0, 8)`, generated fresh on each upload
6. All logo variants use the standard immutable cache policy (`max-age=31536000, immutable`) — cache busting is achieved by changing the version path, not by invalidating old URLs
7. Old version files are **not deleted** immediately (R2 storage is cheap; orphan cleanup can be a future chore task)

### Caching Strategy

The immutable cache + versioned path approach means:
- **Browser**: sees a new URL on each logo change → fetches fresh, no stale cache
- **CDN (Cloudflare)**: each version path is a distinct cache key → no purge needed
- **Old versions**: remain accessible at their URLs indefinitely (harmless, any previous references still work)

### Database Change

New migration `006-site-logo.sql`:

```sql
ALTER TABLE site_settings ADD COLUMN site_logo_version TEXT DEFAULT NULL;
```

`site_logo_version` stores the version string (e.g. `"a1b2c3d4"`). From this value, consuming code derives the full R2 path:
- Base path: `lizhengblog/wp-content/uploads/firefly/site/{version}/`
- Full URL for a given size: `https://assets.lizheng.me/lizhengblog/wp-content/uploads/firefly/site/{version}/logo-{size}.png`

When `site_logo_version` is `NULL`, the site has no custom logo and all consumers fall back to static assets.

### Helper Function

**`src/lib/logo.ts`** (new):
```typescript
const LOGO_BASE_PATH = "lizhengblog/wp-content/uploads/firefly/site";
const CDN_PREFIX = "https://assets.lizheng.me";

export type LogoSize = 16 | 32 | 48 | 80 | 180 | 192 | 512;

export function getLogoUrl(version: string, size: LogoSize): string {
  return `${CDN_PREFIX}/${LOGO_BASE_PATH}/${version}/logo-${size}.png`;
}

export function getLogoR2Key(version: string, size: LogoSize): string {
  return `${LOGO_BASE_PATH}/${version}/logo-${size}.png`;
}
```

This centralizes path construction. All consumers (favicon API, login page, settings form preview) use `getLogoUrl()`.

### Where the Uploaded Logo Appears

| Location | Current | After |
|----------|---------|-------|
| Blog frontend favicon | Static `src/app/favicon.ico` | Dynamic: `/api/favicon` redirects to R2 `logo-32.png` (fallback to static) |
| Login page center | Static `/logo-80.png` | Dynamic: `getLogoUrl(version, 80)` (fallback to static `/logo-80.png`) |
| Blog sidebar | Text "LIZHENG.ME" | **No change** — stays text-only |

### Where the Original Logo Stays Unchanged

| Location | Behavior |
|----------|----------|
| Login page header bar (top ribbon) | Keeps static `/logo-24.png` + "Firefly" branding |
| Admin sidebar top-left | Keeps static `/logo-24.png` + "Firefly" branding |

### Settings Data Layer Changes

**`src/data/settings.ts`**:
- Add `siteLogoVersion: string | null` to `SiteSettings` interface
- Add `siteLogoVersion` to `DEFAULTS` (null)
- Add `siteLogoVersion` to `parseRow()`, `UpdateSiteSettingsInput`
- Existing 5-minute process-level cache: acceptable for single-process deployment. Logo update calls `invalidateSettingsCache()` same as other settings. Document this as a known limitation for future multi-instance scenarios

### API Changes

**`PUT /api/settings`**: accept optional `siteLogoVersion` field.

**`POST /api/upload/logo`** (new route):
1. Accept multipart file upload
2. Validate: must be image (magic-byte check), `width === height` (strict, no tolerance, no crop)
3. Generate version: `crypto.randomUUID().slice(0, 8)`
4. Resize to all 7 target sizes using `sharp`, output as PNG
5. Upload all variants to R2 under `lizhengblog/wp-content/uploads/firefly/site/{version}/`
6. Update `site_settings.site_logo_version` to the new version string
7. Return `{ version, sizes: [{ size, url }] }`

**`GET /api/favicon`** (new route):
1. Read `site_logo_version` from settings
2. Determine target size from `?size` query parameter:
   - Supported values: `16`, `32`, `48`, `180`, `192`, `512`
   - Default (no param or invalid value): `32`
3. If `site_logo_version` is set → 302 redirect to `getLogoUrl(version, size)`
4. If `site_logo_version` is NULL → serve the static `favicon.ico` (for default `32`) or return 404 for other sizes

### Settings Form Changes

**`src/components/admin/settings-form.tsx`**: add a "Site Logo" section at the top:
- Show current logo preview (circular, 80px) using `getLogoUrl(version, 80)`, or a generic placeholder icon if no logo
- Upload button with file picker (click or drag)
- Hint text: "Image must be square (1:1 ratio)"
- On upload success: form re-fetches settings to get new `siteLogoVersion`, preview updates automatically
- No crop UI — server strictly rejects non-square images, front-end shows the error

### Frontend Favicon Integration

**`src/app/layout.tsx`**: change static favicon reference to dynamic:
```tsx
icons: {
  icon: "/api/favicon",
  apple: "/api/favicon?size=180",
}
```

### Login Page Changes

**`src/components/auth/login-card.tsx`**:
- Accept `siteLogoVersion` prop (passed from server component via settings)
- Center avatar: if `siteLogoVersion` exists, render `getLogoUrl(version, 80)`; else fallback to static `/logo-80.png`
- Header ribbon: **no change** — always static `/logo-24.png`

---

## Feature 2: Post Image Upload (Post Editor)

### Current UX Problems

1. `ImageUpload` component uploads an image and directly appends `![](url)` to the markdown textarea — user cannot control insertion position
2. Featured image field is a plain URL input with no upload capability
3. After uploading, user has no way to copy just the URL (e.g. for the featured image field)

### New Design: Unified Upload Zone with Copy Actions

Replace the current `ImageUpload` component with a new `ImageUploadZone` that:

1. **Drag-and-drop area** — sits above the content textarea (same position as current `ImageUpload`)
2. On upload success, shows a **result card** with:
   - Thumbnail preview
   - **Copy URL** button — copies raw URL to clipboard (e.g. `https://assets.lizheng.me/lizhengblog/.../image.png`)
   - **Copy Markdown** button — copies `![filename](url)` to clipboard
   - Each button shows a checkmark (✓) for 800ms after copying
3. Result card persists until user uploads another image (replaces previous) or dismisses it
4. No longer auto-appends to textarea — user copies and pastes manually

### Upload Path

All post images use the same R2 path convention:
- Key: `lizhengblog/wp-content/uploads/firefly/{uuid}.{ext}`
- URL: `https://assets.lizheng.me/lizhengblog/wp-content/uploads/firefly/{uuid}.{ext}`

### Component Changes

**New `src/components/admin/image-upload-zone.tsx`**:
```tsx
interface ImageUploadZoneProps {
  className?: string;
}

// Internal state: { url, filename } | null for last upload result
// Renders: drop zone + result card with copy buttons
```

**Modified `src/components/admin/post-form.tsx`**:
- Replace `<ImageUpload onUpload={handleImageUpload} />` with `<ImageUploadZone />`
- Remove `handleImageUpload` callback (no more auto-append)
- Featured image field: keep as URL input (user copies URL from upload zone and pastes)

### R2 Key Generation Change

**`src/lib/r2.ts`** — new function `generateFireflyR2Key(filename)`:
```typescript
export function generateFireflyR2Key(filename: string): string {
  const ext = extractExtension(filename);
  const uuid = crypto.randomUUID();
  return `lizhengblog/wp-content/uploads/firefly/${uuid}.${ext}`;
}
```

**`src/lib/r2-client.ts`** — modify `uploadToR2()` to accept an optional `keyGenerator` parameter, or create a new `uploadToR2WithKey()` that accepts a pre-generated key.

### API Changes

**`POST /api/upload`**: update to use `generateFireflyR2Key()` instead of `generateR2Key()`.

> Note: since old images in R2 already use the `uploads/YYYY/MM/` path, existing URLs remain valid. Only new uploads use the new path.

---

## Bug Fix: SVG Accept Mismatch

**`src/components/admin/image-upload.tsx`**: remove `image/svg+xml` from the `accept` attribute to match the server-side allowlist in `src/lib/r2.ts`. The server rejects SVG (executable format risk), so the front-end should not offer it as an option.

---

## i18n Keys to Add

```json
// en.json
"admin.settings.siteLogo": "Site Logo",
"admin.settings.siteLogoHint": "Upload a square image. It will be used as favicon and login page avatar.",
"admin.settings.siteLogoUpload": "Upload Logo",
"admin.settings.siteLogoRemove": "Remove",
"admin.settings.siteLogoRequireSquare": "Image must be square (1:1 ratio).",
"admin.settings.siteLogoNotSquare": "The uploaded image is not square. Please use a 1:1 ratio image.",
"admin.upload.copyUrl": "Copy URL",
"admin.upload.copyMarkdown": "Copy Markdown",
"admin.upload.copied": "Copied!"

// zh.json
"admin.settings.siteLogo": "站点图标",
"admin.settings.siteLogoHint": "上传一张正方形图片，将用作站点 favicon 和登录页头像。",
"admin.settings.siteLogoUpload": "上传图标",
"admin.settings.siteLogoRemove": "移除",
"admin.settings.siteLogoRequireSquare": "图片必须为正方形（宽高相等）。",
"admin.settings.siteLogoNotSquare": "上传的图片不是正方形，请使用宽高相等的图片。",
"admin.upload.copyUrl": "复制链接",
"admin.upload.copyMarkdown": "复制 Markdown",
"admin.upload.copied": "已复制！"
```

---

## Dependencies

| Package | Purpose | Reason |
|---------|---------|--------|
| `sharp` | Server-side image resizing | Resize site logo to multiple PNG sizes; Node.js native, fast |

> `sharp` is the standard choice for Node.js image processing. It supports PNG/JPEG/WebP/AVIF and handles resize + format conversion efficiently.

---

## Files to Modify

| File | Change |
|------|--------|
| `scripts/migrations/006-site-logo.sql` | **New** — add `site_logo_version` column |
| `src/data/settings.ts` | Add `siteLogoVersion` field to types, parse, update |
| `src/lib/r2.ts` | Add `generateFireflyR2Key()`, add `extractExtension()` export |
| `src/lib/r2-client.ts` | Support custom key in upload |
| `src/lib/logo.ts` | **New** — `getLogoUrl()`, `getLogoR2Key()` helpers |
| `src/app/api/upload/route.ts` | Use new key generator |
| `src/app/api/upload/logo/route.ts` | **New** — logo upload with resize + version |
| `src/app/api/favicon/route.ts` | **New** — dynamic favicon with `?size` parameter |
| `src/components/admin/image-upload-zone.tsx` | **New** — upload zone with copy buttons |
| `src/components/admin/image-upload.tsx` | Remove `image/svg+xml` from accept; deprecate component |
| `src/components/admin/post-form.tsx` | Use `ImageUploadZone` instead of `ImageUpload` |
| `src/components/admin/settings-form.tsx` | Add logo upload section |
| `src/components/auth/login-card.tsx` | Dynamic logo from `siteLogoVersion` |
| `src/app/login/page.tsx` | Pass `siteLogoVersion` to `LoginCard` |
| `src/app/layout.tsx` | Dynamic favicon reference |
| `src/i18n/locales/en.json` | Add i18n keys |
| `src/i18n/locales/zh.json` | Add i18n keys |

---

## Atomic Commits

| # | Commit | Description |
|---|--------|-------------|
| 1 | `fix: remove svg from image-upload accept attribute` | Align front-end with server-side SVG rejection |
| 2 | `feat: add site_logo_version to site_settings` | Migration 006 + data layer + settings API |
| 3 | `feat: add logo URL helper module` | New `src/lib/logo.ts` with `getLogoUrl()` / `getLogoR2Key()` |
| 4 | `feat: add GUID-based R2 key generation` | `generateFireflyR2Key()` in `r2.ts`, update `r2-client.ts` |
| 5 | `feat: update upload API to use new R2 path` | Modify `POST /api/upload` |
| 6 | `feat: add logo upload API with multi-size resize` | New `POST /api/upload/logo` route, install `sharp` |
| 7 | `feat: add dynamic favicon API with size parameter` | New `GET /api/favicon` with `?size=16|32|48|180|192|512` |
| 8 | `feat: add site logo upload to settings page` | Settings form UI + logo preview |
| 9 | `feat: integrate dynamic logo in login page` | `LoginCard` accepts `siteLogoVersion` prop |
| 10 | `feat: integrate dynamic favicon in layout` | Update `layout.tsx` metadata |
| 11 | `feat: add ImageUploadZone with copy actions` | New component with copy URL / copy Markdown |
| 12 | `refactor: replace ImageUpload with ImageUploadZone in PostForm` | Swap component, remove auto-append |
| 13 | `feat: add i18n keys for image upload` | en.json + zh.json |
