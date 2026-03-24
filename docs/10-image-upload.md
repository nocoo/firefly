# 10 — Image Upload System

Complete image upload functionality for the blog admin, covering site logo upload (settings page) and post image upload (post editor). All images are stored in Cloudflare R2.

## Current State

### What Exists

- **R2 client** (`src/lib/r2-client.ts`): S3Client singleton, `uploadToR2()`, `deleteFromR2()`
- **R2 validation** (`src/lib/r2.ts`): magic-byte detection, MIME allowlist, size limit (10 MB), key generation (`uploads/YYYY/MM/timestamp-filename`)
- **Upload API** (`src/app/api/upload/route.ts`): `POST /api/upload`, multipart form-data → R2
- **ImageUpload component** (`src/components/admin/image-upload.tsx`): click + drag-drop, calls `/api/upload`, returns URL via `onUpload` callback
- **PostForm** (`src/components/admin/post-form.tsx`): uses `ImageUpload` for content images (appends `![](url)` to markdown); featured image is a plain `<input type="url">` with no upload capability
- **Settings page** (`src/components/admin/settings-form.tsx`): 4 fields (locale, postsPerPage, commentsEnabled, fontStyle) — no logo/image field
- **Favicon**: static `src/app/favicon.ico`, no dynamic override
- **Login page** (`src/components/auth/login-card.tsx`): uses static `/logo-24.png` (header bar) and `/logo-80.png` (center avatar)
- **Blog sidebar** (`src/components/blog/blog-sidebar.tsx`): text-only site name "LIZHENG.ME", no logo image
- **Site settings DB** (`site_settings`): no `site_logo` column

### R2 Configuration

| Item | Value |
|------|-------|
| Bucket | `lizhengblog` |
| Upload path prefix | `lizhengblog/wp-content/uploads/firefly/` |
| File naming | GUID (e.g. `a1b2c3d4-e5f6-7890-abcd-ef1234567890.png`) |
| CDN prefix | `https://assets.lizheng.me` |
| Env vars | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (stored in `~/workspace/personal/firefly/.env`) |
| Account ID | existing `CF_ACCOUNT_ID` in `.env` |

### Key Difference from Current Upload Logic

Current `generateR2Key()` produces `uploads/YYYY/MM/timestamp-filename`. The new behavior requires:
- **Path prefix**: `lizhengblog/wp-content/uploads/firefly/`
- **File naming**: GUID-based (e.g. `{uuid}.{ext}`)
- **Full key example**: `lizhengblog/wp-content/uploads/firefly/a1b2c3d4.png`

---

## Feature 1: Site Logo Upload (Settings Page)

### Behavior

1. User uploads a **square** image on the settings page
2. Server validates aspect ratio (must be 1:1) and resizes to multiple sizes:
   - `logo-16.png` — favicon 16×16
   - `logo-32.png` — favicon 32×32
   - `logo-48.png` — favicon 48×48
   - `logo-180.png` — Apple touch icon 180×180
   - `logo-192.png` — PWA icon 192×192
   - `logo-512.png` — PWA icon 512×512
   - `logo-80.png` — login page center avatar (matches current static size)
3. All variants are uploaded to R2 under `lizhengblog/wp-content/uploads/firefly/site/logo-{size}.png`
4. The URL of the base image (original) is stored in `site_settings.site_logo` column

### Where the Uploaded Logo Appears

| Location | Current | After |
|----------|---------|-------|
| Blog frontend favicon | Static `src/app/favicon.ico` | Dynamic: `/api/favicon` serves `logo-32.png` from R2 (fallback to static) |
| Login page center | Static `/logo-80.png` | Dynamic: `logo-80.png` from R2 (fallback to static) |
| Blog sidebar | Text "LIZHENG.ME" | **No change** — stays text-only |

### Where the Original Logo Stays Unchanged

| Location | Behavior |
|----------|----------|
| Login page header bar (top ribbon) | Keeps static `/logo-24.png` + "Firefly" branding |
| Admin sidebar top-left | Keeps static `/logo-24.png` + "Firefly" branding |

### Database Change

New migration `006-site-logo.sql`:

```sql
ALTER TABLE site_settings ADD COLUMN site_logo TEXT DEFAULT NULL;
```

`site_logo` stores the R2 public URL of the original uploaded image (e.g. `https://assets.lizheng.me/lizhengblog/wp-content/uploads/firefly/site/logo-original.png`).

### Settings Data Layer Changes

**`src/data/settings.ts`**:
- Add `siteLogo: string | null` to `SiteSettings` interface
- Add `siteLogo` to `DEFAULTS` (null)
- Add `siteLogo` to `parseRow()`, `UpdateSiteSettingsInput`

### API Changes

**`PUT /api/settings`**: accept optional `siteLogo` field.

**`POST /api/upload/logo`** (new route):
1. Accept multipart file upload
2. Validate: must be image, must be square (tolerance ±2px)
3. Resize to all target sizes using `sharp` library
4. Upload all variants to R2 under `lizhengblog/wp-content/uploads/firefly/site/`
5. Return `{ url: "https://assets.lizheng.me/...", sizes: [...] }`

**`GET /api/favicon`** (new route):
1. Read `site_logo` from settings
2. If set → redirect (302) to the `logo-32.png` R2 URL
3. If not set → serve the static `favicon.ico`

### Settings Form Changes

**`src/components/admin/settings-form.tsx`**: add a "Site Logo" section at the top:
- Show current logo preview (circular, 80px) or placeholder
- Upload button (reuse `ImageUpload` component pattern but with square-crop validation feedback)
- Show "must be square" hint text
- On successful upload, update the settings via API

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
- Accept `siteLogo` prop (passed from server component)
- Center avatar: if `siteLogo` exists, render R2 `logo-80.png` URL; else fallback to static `/logo-80.png`
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

## i18n Keys to Add

```json
// en.json
"admin.settings.siteLogo": "Site Logo",
"admin.settings.siteLogoHint": "Upload a square image. It will be used as favicon and login page avatar.",
"admin.settings.siteLogoUpload": "Upload Logo",
"admin.settings.siteLogoRemove": "Remove",
"admin.settings.siteLogoRequireSquare": "Image must be square (1:1 ratio).",
"admin.upload.copyUrl": "Copy URL",
"admin.upload.copyMarkdown": "Copy Markdown",
"admin.upload.copied": "Copied!"

// zh.json
"admin.settings.siteLogo": "站点图标",
"admin.settings.siteLogoHint": "上传一张方形图片，将用作站点 favicon 和登录页头像。",
"admin.settings.siteLogoUpload": "上传图标",
"admin.settings.siteLogoRemove": "移除",
"admin.settings.siteLogoRequireSquare": "图片必须为正方形（1:1 比例）。",
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
| `scripts/migrations/006-site-logo.sql` | **New** — add `site_logo` column |
| `src/data/settings.ts` | Add `siteLogo` field to types, parse, update |
| `src/lib/r2.ts` | Add `generateFireflyR2Key()` function |
| `src/lib/r2-client.ts` | Support custom key in upload |
| `src/app/api/upload/route.ts` | Use new key generator |
| `src/app/api/upload/logo/route.ts` | **New** — logo upload with resize |
| `src/app/api/favicon/route.ts` | **New** — dynamic favicon serving |
| `src/components/admin/image-upload-zone.tsx` | **New** — upload zone with copy buttons |
| `src/components/admin/image-upload.tsx` | Deprecate (keep for backward compat, may remove later) |
| `src/components/admin/post-form.tsx` | Use `ImageUploadZone` instead of `ImageUpload` |
| `src/components/admin/settings-form.tsx` | Add logo upload section |
| `src/components/auth/login-card.tsx` | Dynamic logo from settings |
| `src/app/login/page.tsx` | Pass `siteLogo` to `LoginCard` |
| `src/app/layout.tsx` | Dynamic favicon reference |
| `src/i18n/locales/en.json` | Add i18n keys |
| `src/i18n/locales/zh.json` | Add i18n keys |

---

## Atomic Commits

| # | Commit | Description |
|---|--------|-------------|
| 1 | `feat: add site_logo column to site_settings` | Migration 006 + data layer changes |
| 2 | `feat: add GUID-based R2 key generation` | `generateFireflyR2Key()` in `r2.ts`, update `r2-client.ts` |
| 3 | `feat: update upload API to use new R2 path` | Modify `POST /api/upload` |
| 4 | `feat: add logo upload API with multi-size resize` | New `POST /api/upload/logo` route, install `sharp` |
| 5 | `feat: add dynamic favicon API` | New `GET /api/favicon` route |
| 6 | `feat: add site logo upload to settings page` | Settings form UI + logo preview |
| 7 | `feat: integrate dynamic logo in login page` | `LoginCard` accepts `siteLogo` prop |
| 8 | `feat: integrate dynamic favicon in layout` | Update `layout.tsx` metadata |
| 9 | `feat: add ImageUploadZone with copy actions` | New component with copy URL / copy Markdown |
| 10 | `refactor: replace ImageUpload with ImageUploadZone in PostForm` | Swap component, remove auto-append |
| 11 | `feat: add i18n keys for image upload` | en.json + zh.json |
