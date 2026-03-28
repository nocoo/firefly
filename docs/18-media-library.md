# 18 — Media Library

> Add a media library system: persistent upload records in DB, continuous upload
> in post editor, dedicated media management page, and R2 initial sync.
>
> Date: 2026-03-27
> Prerequisite: [10-image-upload.md](./10-image-upload.md) (completed)
> Status: ✅ Implemented

---

## Problem Statement

1. **Upload component loses state**: `ImageUploadZone` uses single `result` state —
   uploading a second image replaces the first. Users cannot see previous uploads.
2. **No DB persistence**: Uploads go directly to R2 and return a URL, but the existing
   `attachments` table (001-init.sql) is never populated. No way to browse history.
3. **No media management**: No dedicated page to view or delete uploaded images.
4. **No post association**: Cannot see which images were uploaded for a specific post.

## Goals

- Post editor: continuous uploads with visible history list
- Media library page in admin (/admin/media) with grid view
- All uploads persist in `attachments` table with optional `post_id` association
- Initial R2 sync: scan ~2053 existing objects into DB
- Hard delete: remove from both DB and R2

### Non-goals (V1)

- **Search / filter by filename**: Not included in V1. Media library shows a
  chronological grid with pagination only. Search can be added later as a
  follow-up if the volume of media makes browsing impractical.
- **Drag-and-drop reorder**: Cards are ordered by `created_at DESC`, no custom sorting.
- **Bulk operations**: No multi-select / bulk delete in V1.

---

## Current Architecture

### Existing `attachments` Table (001-init.sql, line 114)

```sql
CREATE TABLE IF NOT EXISTS attachments (
  id            TEXT PRIMARY KEY,  -- ULID
  filename      TEXT NOT NULL,
  r2_key        TEXT NOT NULL UNIQUE,
  mime_type     TEXT NOT NULL,
  size          INTEGER,
  width         INTEGER,
  height        INTEGER,
  alt_text      TEXT,
  wp_id         INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
```

> **Missing**: `post_id` column for post association.

### Upload Flow (current)

```
ImageUploadZone → fetch POST /api/upload
  → r2.ts: generateFireflyR2Key()
  → r2-client.ts: uploadToR2() → S3 PutObject → R2
  → return { key, url, size, mimeType }
  (DB attachments table is NEVER written)
```

### Reusable Code

| Module | Function | Location |
|--------|----------|----------|
| Upload to R2 | `uploadToR2(buffer, filename, mime, key)` | `src/lib/r2-client.ts` |
| Delete from R2 | `deleteFromR2(key)` | `src/lib/r2-client.ts` |
| Key generation | `generateFireflyR2Key(filename)` | `src/lib/r2.ts` |
| Validation | `validateUpload(data, mime)` | `src/lib/r2.ts` |
| R2 list pagination | `listAllObjects()` | `scripts/migrations/01-audit-r2-images.ts` |
| Confirm dialog | `ConfirmDialog` | `src/components/admin/confirm-dialog.tsx` |
| DB helper pattern | `getDb()`, query patterns | `src/data/posts.ts` |
| ULID generation | `import { ulid } from "ulid"` | Used across `src/data/*.ts` |

---

## Step 1: DB Migration — Add `post_id` to `attachments`

**Goal**: Add optional post association and time-based index.

### 1.1 Create Migration

**File**: `scripts/migrations/011-media-post-id.sql` (new)

```sql
-- 011: Add post_id and created_at index to attachments for media library
ALTER TABLE attachments ADD COLUMN post_id TEXT REFERENCES posts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_post_id ON attachments(post_id);
CREATE INDEX IF NOT EXISTS idx_attachments_created_at ON attachments(created_at);
```

### 1.2 Update Shared Domain Types

The `Attachment` interface in `src/models/types.ts` must stay in sync with the DB
schema. The backup types also need `post_id` so exports don't silently drop it.

**File**: `src/models/types.ts` — add `post_id` to `Attachment`:

```typescript
export interface Attachment {
  // ... existing fields ...
  alt_text: string | null;
  post_id: string | null;   // ← NEW: optional post association
  wp_id: number | null;
  created_at: number;
}
```

**File**: `src/models/backup-schema.ts` — add `post_id` to `ExportedAttachment`:

```typescript
export interface ExportedAttachment {
  // ... existing fields ...
  alt_text: string | null;
  post_id: string | null;   // ← NEW
  wp_id: number | null;
  created_at: string;
}
```

**File**: `src/data/backup-export.ts` — add `post_id` to `convertAttachment()`:

```typescript
function convertAttachment(a: Attachment): ExportedAttachment {
  return {
    // ... existing fields ...
    alt_text: a.alt_text,
    post_id: a.post_id,   // ← NEW: pass through as-is (no epoch conversion)
    wp_id: a.wp_id,
    created_at: epochToIso(a.created_at),
  };
}
```

### Files Modified

| File | Change |
|------|--------|
| `scripts/migrations/011-media-post-id.sql` | New — migration |
| `src/models/types.ts` | Add `post_id` to `Attachment` interface |
| `src/models/backup-schema.ts` | Add `post_id` to `ExportedAttachment` interface |
| `src/data/backup-export.ts` | Add `post_id` to `convertAttachment()` |

### Atomic Commit

| # | Message |
|---|---------|
| 1 | `feat: add post_id column and indexes to attachments table` | ✅ |

---

## Step 2: Data Access Layer — `src/data/media.ts`

**Goal**: CRUD operations for the `attachments` table.

### 2.1 Create Data Layer

**File**: `src/data/media.ts` (new)

```typescript
import type { Db } from "@/lib/db";
import type { Attachment } from "@/models/types";
import { ulid } from "ulid";

// Re-export for convenience
export type { Attachment };

export interface CreateMediaInput {
  filename: string;
  r2Key: string;
  mimeType: string;
  size?: number;
  width?: number;
  height?: number;
  postId?: string;
}

// List media with pagination, optional post_id filter
export async function listMedia(
  db: Db,
  opts: { page?: number; pageSize?: number; postId?: string }
): Promise<{ media: Attachment[]; total: number }>

// Get single media by id
export async function getMedia(
  db: Db,
  id: string
): Promise<Attachment | null>

// Create media record (called after R2 upload)
export async function createMedia(
  db: Db,
  input: CreateMediaInput
): Promise<Attachment>

// Delete media record by id
export async function deleteMedia(
  db: Db,
  id: string
): Promise<void>

// List media by post (for editor gallery)
export async function listMediaByPost(
  db: Db,
  postId: string
): Promise<Attachment[]>

// Batch create (for R2 sync script) — inserts in chunks of 50
export async function batchCreateMedia(
  db: Db,
  items: Array<Omit<CreateMediaInput, "postId">>
): Promise<number>
```

> **Note**: `Attachment` is imported from `src/models/types.ts` (single source of truth),
> NOT redefined locally. All functions take `db: Db` from `src/lib/db.ts`,
> NOT `D1Database`. Read operations use `db.query()` / `db.firstOrNull()`,
> write operations use `db.execute()`, batch writes use `db.batch()`.

### 2.2 Unit Tests

**File**: `src/data/media.test.ts` (new)

Test cases:
- `createMedia`: returns created record with ULID id
- `getMedia`: returns record by id, returns null for non-existent
- `listMedia`: pagination (page/pageSize), total count, desc order by created_at
- `listMedia` with `postId` filter
- `listMediaByPost`: returns only media for specific post
- `deleteMedia`: removes record, get returns null after delete
- `batchCreateMedia`: inserts multiple records, skips duplicates (r2_key UNIQUE)

### Files Modified

| File | Change |
|------|--------|
| `src/data/media.ts` | New — data access layer |
| `src/data/media.test.ts` | New — unit tests |

### Atomic Commit

| # | Message |
|---|---------|
| 2 | `feat: add media data access layer with CRUD operations` | ✅ |

---

## Step 3: API Routes — `/api/media`

**Goal**: REST API for media CRUD with R2 integration.

### 3.1 List + Create

**File**: `src/app/api/media/route.ts` (new)

**GET `/api/media`** (auth required):
- Query params: `page` (default 1), `page_size` (default 24), `post_id` (optional)
- Returns: `{ media: Attachment[], total: number, page: number, pageSize: number }`

**POST `/api/media`** (auth required):
- Accept: `multipart/form-data` with `file` field + optional `post_id` field
- Flow:
  1. Parse formData → extract file and post_id
  2. `generateFireflyR2Key(filename)` → R2 key
  3. `uploadToR2(buffer, filename, mimeType, key)` → R2
  4. `createMedia(db, { filename, r2Key, mimeType, size, postId })` → DB
  5. Return 201 + `{ id, url, filename, r2_key, ... }`

### 3.2 Get + Delete

**File**: `src/app/api/media/[id]/route.ts` (new)

**GET `/api/media/[id]`** (auth required):
- Returns single attachment or 404

**DELETE `/api/media/[id]`** (auth required):
- Flow:
  1. `getMedia(db, id)` → look up record (404 if not found)
  2. `deleteFromR2(record.r2_key)` → remove from R2
  3. `deleteMedia(db, id)` → remove from DB
  4. Return 204

### Files Modified

| File | Change |
|------|--------|
| `src/app/api/media/route.ts` | New — GET list + POST create |
| `src/app/api/media/[id]/route.ts` | New — GET single + DELETE |

### Atomic Commit

| # | Message |
|---|---------|
| 3 | `feat: add media API routes for list, create, and delete` | ✅ |

---

## Step 4: Upgrade Upload Component — Continuous Upload List

**Goal**: Replace single-result state with array, call new `/api/media` endpoint.

### 4.1 Modify `ImageUploadZone`

**File**: `src/components/admin/image-upload-zone.tsx`

Key changes:
- Add props: `postId?: string`, `results: UploadResult[]`, `onResultsChange: (results: UploadResult[]) => void`
- **Controlled component**: No internal `result` / `results` state.
  Parent owns the array; this component renders it and calls `onResultsChange` on upload.
- New interface: `UploadResult { id: string; url: string; filename: string }`
- Upload calls `POST /api/media` with `file` + optional `post_id` in FormData
- New uploads prepend to `results` array via `onResultsChange([newResult, ...results])`
- Each result card: thumbnail + copy URL + copy Markdown + dismiss (× button)
- Container scrolls when >3 items (max-height with overflow-y)

### 4.2 Modify `PostForm` — Shared Upload State (Critical)

**File**: `src/components/admin/post-form.tsx`

**Problem**: `PostForm` renders TWO `ImageUploadZone` instances — one in the
mobile `lg:hidden` block (line 325) and one in the desktop `hidden lg:block`
block (line 340). If each instance maintains its own `results` state:
- `useRef` can only point to one instance
- Uploads in mobile are invisible to the desktop instance and vice versa
- Edit-mode preload would fire twice
- Post-save backfill would read from whichever ref happens to be mounted

**Solution**: Lift upload state into `PostForm` and pass it down as props.

```typescript
// In PostForm:
const [uploadedMedia, setUploadedMedia] = useState<UploadResult[]>([]);

// On mount (edit mode): fetch existing media
useEffect(() => {
  if (post?.id) {
    fetch(`/api/media?post_id=${post.id}`)
      .then(res => res.json())
      .then(data => setUploadedMedia(data.media.map(toUploadResult)));
  }
}, [post?.id]);

// Both instances share the same state:
<ImageUploadZone
  postId={post?.id}
  results={uploadedMedia}
  onResultsChange={setUploadedMedia}
  className="mb-2"
/>
```

Both the mobile and desktop `<ImageUploadZone />` receive the same
`results` + `onResultsChange` props. Whichever instance the user interacts
with updates the shared state; both instances reflect it.

On save, `PostForm` reads `uploadedMedia` directly (no ref needed):
```typescript
const mediaIds = uploadedMedia.map(r => r.id);
```

### 4.3 Post-save Backfill — Critical for New Post Scenario

**Problem**: When creating a new post, there is no `post.id` yet. Images uploaded
during editing get `post_id = NULL` in the DB.

**Solution**: After `POST /api/posts` returns the new post (with `id` + `slug`),
call `PATCH /api/media/associate` to backfill `post_id` on all media IDs from
the upload zone.

**File**: `src/app/api/media/associate/route.ts` (new)

**PATCH `/api/media/associate`** (auth required):
- Body: `{ mediaIds: string[], postId: string }`
- Flow:
  1. Validate `postId` exists in posts table
  2. Build dynamic placeholders for the array:
     ```typescript
     const placeholders = mediaIds.map(() => "?").join(", ");
     await db.execute(
       `UPDATE attachments SET post_id = ? WHERE id IN (${placeholders}) AND post_id IS NULL`,
       [postId, ...mediaIds]
     );
     ```
     Alternatively, use `db.batch()` with one UPDATE per media ID if the array
     could be large (>50 items, unlikely for a single post).
  3. Return 200 + `{ updated: number }` (from `meta.changes`)

**PostForm save flow** (updated):
```
1. User clicks "Create Post"
2. POST /api/posts → { id, slug }
3. Read mediaIds from shared uploadedMedia state:
   const mediaIds = uploadedMedia.map(r => r.id);
4. If mediaIds.length > 0:
   PATCH /api/media/associate { mediaIds, postId: newPost.id }
5. router.push("/admin/posts")
```

> This also works for edit mode: if user uploads new images while editing,
> those are created with the existing `post.id` via the `postId` prop.
> Backfill only runs when `postId` was missing at upload time.

### Files Modified

| File | Change |
|------|--------|
| `src/components/admin/image-upload-zone.tsx` | Single → array results, call /api/media |
| `src/components/admin/post-form.tsx` | Pass postId, backfill after create |
| `src/app/api/media/associate/route.ts` | New — PATCH endpoint for backfill |

### Atomic Commit

| # | Message |
|---|---------|
| 4 | `feat: upgrade image upload zone to support continuous uploads` | ✅ |

---

## Step 5: Media Library Page

**Goal**: Admin page at `/admin/media` with image grid and management.

### 5.1 Server Page

**File**: `src/app/admin/media/page.tsx` (new)

Server component — fetch initial media list and pass to client component.

### 5.2 Client Component

**File**: `src/components/admin/media-library.tsx` (new)

Features:
- **Grid layout**: Responsive — 2 cols (mobile) / 3 cols (tablet) / 4 cols (desktop)
- **Each card**:
  - Thumbnail image (object-cover, rounded)
  - Filename (truncated)
  - File size (human-readable)
  - Upload date
  - Copy URL button
  - Copy Markdown button
  - Delete button (with `ConfirmDialog`)
- **Pagination**: "Load more" button or page navigation
- **Empty state**: "No media found" with upload suggestion

### 5.3 Add Navigation

**File**: `src/components/admin/sidebar.tsx`

Add to Content group (after Tags):
```typescript
{ titleKey: "admin.nav.media", href: "/admin/media", icon: ImageIcon }
```

Import `Image as ImageIcon` from `lucide-react`.

**File**: `src/components/admin/shell.tsx`

Add to `PAGE_TITLE_KEYS`:
```typescript
"/admin/media": "admin.nav.media",
```

### 5.4 i18n Keys

**Files**: `src/i18n/locales/en.json` + `src/i18n/locales/zh.json`

```json
{
  "admin.nav.media": "Media",
  "admin.media.title": "Media Library",
  "admin.media.empty": "No media found",
  "admin.media.emptyHint": "Upload images through the post editor or drag & drop here.",
  "admin.media.delete": "Delete",
  "admin.media.confirmDelete": "Delete this image? It will be permanently removed from storage.",
  "admin.media.deleted": "Image deleted",
  "admin.media.copyUrl": "Copy URL",
  "admin.media.copyMarkdown": "Copy Markdown",
  "admin.media.copied": "Copied!",
  "admin.media.loadMore": "Load more",
  "admin.media.showing": "Showing {count} of {total}"
}
```

### Files Modified

| File | Change |
|------|--------|
| `src/app/admin/media/page.tsx` | New — server page |
| `src/components/admin/media-library.tsx` | New — client component |
| `src/components/admin/sidebar.tsx` | Add Media nav item |
| `src/components/admin/shell.tsx` | Add title key |
| `src/i18n/locales/en.json` | Add media keys |
| `src/i18n/locales/zh.json` | Add media keys |

### Atomic Commits

| # | Message |
|---|---------|
| 5 | `feat: add media library page with grid view and pagination` | ✅ |
| 6 | `feat: add media link to admin sidebar and i18n keys` | ✅ |

---

## Step 6: R2 Initial Sync Script

**Goal**: Scan ~2053 existing R2 objects into `attachments` table.

### 6.1 Create Sync Script

**File**: `scripts/migrations/02-sync-r2-to-db.ts` (new)

Logic (reuse `01-audit-r2-images.ts` ListObjectsV2 pagination pattern):

```
1. Connect to R2 via S3Client (same as 01-audit)
2. ListObjectsV2 with pagination (MaxKeys=1000)
3. For each object:
   a. Extract filename from key (last path segment)
   b. Detect mime_type from file extension
   c. Check if r2_key already in attachments → skip if exists
   d. Convert R2 lastModified to Unix epoch seconds:
      Math.floor(object.LastModified.getTime() / 1000)
      (R2 returns Date object; DB stores integer unixepoch)
4. Batch INSERT in groups of 50 using db.batch():
   db.batch(items.map(item => ({
     sql: "INSERT INTO attachments (...) VALUES (?, ?, ?, ?, ?, ?)",
     params: [ulid(), item.filename, item.r2Key, item.mimeType, item.size, item.createdAt]
   })))
5. Report: total scanned, new inserted, already existed, errors
```

**DB access**: Uses the project's `Db` interface from `src/lib/db.ts`:
- Read (check existing): `db.query()` via Worker `/api/v1/query`
- Write (insert): `db.execute()` or `db.batch()` via Worker `/api/v1/execute`
- **NOT** raw HTTP to `/api/v1/query` for writes (that endpoint is read-only)

**Timestamp**: R2 `ListObjectsV2` returns `LastModified` as a JavaScript `Date`.
The `attachments.created_at` column is `INTEGER DEFAULT (unixepoch())` — Unix epoch
in seconds. Must convert: `Math.floor(date.getTime() / 1000)`.
Do **NOT** store ISO string directly — it would cause type mismatch.

Usage:
```bash
bun scripts/migrations/02-sync-r2-to-db.ts
bun scripts/migrations/02-sync-r2-to-db.ts --test  # target test DB
```

### Files Modified

| File | Change |
|------|--------|
| `scripts/migrations/02-sync-r2-to-db.ts` | New — R2 → DB sync script |

### Atomic Commit

| # | Message |
|---|---------|
| 7 | `feat: add R2 to DB sync script for initial media library population` | ✅ |

---

## Step 7: E2E Tests + Documentation

### 7.1 API E2E Tests

**File**: `e2e/api/media.test.ts` (new)

Test cases:
- `GET /api/media` — returns paginated list
- `GET /api/media?post_id=xxx` — filters by post
- `POST /api/media` — upload file + create DB record, returns 201
- `GET /api/media/[id]` — returns single record
- `DELETE /api/media/[id]` — hard deletes (DB + R2), returns 204
- `DELETE /api/media/[nonexistent]` — returns 404
- `PATCH /api/media/associate` — backfills `post_id` on orphaned media records
- `PATCH /api/media/associate` — does not overwrite already-associated records
- `PATCH /api/media/associate` — returns 400 for non-existent `postId`

### 7.2 Update docs/README.md

Add entry for doc 18.

### Files Modified

| File | Change |
|------|--------|
| `e2e/api/media.test.ts` | New — L2 E2E tests |
| `docs/README.md` | Add doc 18 entry |

### Atomic Commits

| # | Message |
|---|---------|
| 8 | `test: add L2 E2E tests for media API endpoints` | ✅ |
| 9 | `docs: mark media library document as implemented` | ✅ |

---

## Complete Atomic Commit Sequence

| # | Type | Message | Scope |
|---|------|---------|-------|
| 1 | feat | `feat: add post_id column and indexes to attachments table` | DB |
| 2 | feat | `feat: add media data access layer with CRUD operations` | Data + tests |
| 3 | feat | `feat: add media API routes for list, create, and delete` | API |
| 4 | feat | `feat: upgrade image upload zone to support continuous uploads` | Component |
| 5 | feat | `feat: add media library page with grid view and pagination` | Admin page |
| 6 | feat | `feat: add media link to admin sidebar and i18n keys` | Nav + i18n |
| 7 | feat | `feat: add R2 to DB sync script for initial media library population` | Script |
| 8 | test | `test: add L2 E2E tests for media API endpoints` | E2E |
| 9 | docs | `docs: mark media library document as implemented` | Docs |

---

## Execution Order Rationale

1. **DB migration first** — Schema must exist before data layer.
2. **Data layer next** — Pure functions, easily testable, no UI dependency.
3. **API routes** — Depends on data layer. Can be E2E tested immediately.
4. **Upload component upgrade** — Depends on new API. Post editor UX fix.
5. **Media library page** — Depends on API + nav updates. Largest visual change.
6. **R2 sync script** — Independent of UI, but benefits from DB + API being ready.
7. **E2E tests** — Validate full stack after all pieces are in place.
8. **Docs** — Capture final state.

---

## Key Files Map

```
scripts/migrations/011-media-post-id.sql          ← NEW: DB migration
src/models/types.ts                                ← MODIFY: add post_id to Attachment
src/models/backup-schema.ts                        ← MODIFY: add post_id to ExportedAttachment
src/data/backup-export.ts                          ← MODIFY: add post_id to convertAttachment()
src/data/media.ts                                  ← NEW: Data access layer (uses Db interface)
src/data/media.test.ts                             ← NEW: Unit tests
src/app/api/media/route.ts                         ← NEW: List + Create API
src/app/api/media/[id]/route.ts                    ← NEW: Get + Delete API
src/app/api/media/associate/route.ts               ← NEW: PATCH backfill post_id
src/components/admin/image-upload-zone.tsx          ← MODIFY: array results, /api/media
src/components/admin/post-form.tsx                  ← MODIFY: pass postId, load gallery, backfill
src/app/admin/media/page.tsx                        ← NEW: Media library page
src/components/admin/media-library.tsx              ← NEW: Media grid component
src/components/admin/sidebar.tsx                    ← MODIFY: add Media nav
src/components/admin/shell.tsx                      ← MODIFY: add title key
src/i18n/locales/en.json                           ← MODIFY: add media i18n keys
src/i18n/locales/zh.json                           ← MODIFY: add media i18n keys
scripts/migrations/02-sync-r2-to-db.ts             ← NEW: R2 sync script (uses Db interface)
e2e/api/media.test.ts                              ← NEW: E2E tests
```

---

## Risk Notes

- **D1 batch insert limit**: D1 has a max of 100 bound parameters per query.
  Use `db.batch()` from `src/lib/db.ts` which maps to Worker `/api/v1/execute`
  with `{ statements: [...] }`. Each statement is an individual INSERT with ~6 params.
  Batch in groups of 50 statements per `db.batch()` call.
- **R2 ListObjectsV2 pagination**: ~2053 objects = 3 pages at MaxKeys=1000. Fast.
- **R2 timestamp conversion**: `LastModified` from S3 is a `Date` object. Must convert
  to Unix epoch seconds via `Math.floor(date.getTime() / 1000)` before inserting into
  `attachments.created_at` (INTEGER column with `unixepoch()` default).
- **MIME detection from extension**: For legacy objects without headers, extension-based
  detection is the only option. Map: `.jpg/.jpeg` → `image/jpeg`, `.png` → `image/png`,
  `.gif` → `image/gif`, `.webp` → `image/webp`, `.avif` → `image/avif`.
  Unknown extensions → `application/octet-stream`.
- **Existing `/api/upload` route**: Keep it working as-is for backward compatibility.
  Logo upload uses its own dedicated route (`/api/upload/logo`), not `/api/upload`.
  New media-aware uploads go through `/api/media` POST.
- **`wp_id` in attachments**: Legacy WordPress IDs. Sync script preserves any existing
  `wp_id` records and only inserts new ones where `r2_key` doesn't already exist.
