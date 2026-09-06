# Journal social previews and public identity

Updated: 2026-09-07.

## Homepage

The homepage previously returned no `og:image`; its page-level Open Graph object
replaced the root layout's file-based image metadata. Twitter used a small
`summary` card. The root `opengraph-image.png` is a Firefly application asset,
not the Journal's public sharing identity.

The homepage now publishes:

| Field | Value |
| --- | --- |
| HTML / Open Graph / Twitter title | 李征 — 博客 |
| Description | 关于软件工程、AI 与团队管理的实践，也记录个人观察与日常。 |
| Open Graph type / locale | `website` / `zh_CN` |
| Twitter card | `summary_large_image` |
| Image | 1200 × 630 JPEG, approximately 55 KiB |

![Journal homepage social card](../public/social/journal-zh.57dfb0b67f98.jpg)

Copy, image URL, dimensions, MIME type, and image alt text are kept in
[`src/lib/home-social.json`](../src/lib/home-social.json). `buildHomeMeta` supplies
explicit image metadata and an absolute title, avoiding both root image
inheritance and a repeated site-name suffix. The homepage's WebSite description
uses the same copy. Site-name and Twitter-account settings remain available;
Twitter handles are normalized to a single leading `@` throughout the metadata.

The illustration is an original SVG notebook and fountain pen, with the shared
four-square mark and Journal palette. No generated photograph or image API is
needed. The public file is an opaque JPEG; its content hash changes when its
pixels change. `/social/` contains these versioned assets and uses immutable
caching. Keep previously published image files when producing a new version so
cached page metadata can still resolve its image.

## Articles

Article Open Graph and Twitter titles remain the article title. An article with
a `featured_image` continues to use that exact image URL. Without one, the
existing `/api/og?title=…&subtitle=…` article card remains the fallback. The
homepage card is assigned only to the homepage.

## Browser identity and domains

- The public layout explicitly links a 180 × 180 PNG Apple touch icon based on
  `public/journal-icon.svg`. `/apple-touch-icon` and
  `/apple-touch-icon-precomposed.png` resolve to the same PNG.
- `/favicon.ico` already returned a valid ICO. The Journal continues to link
  its own SVG mark; Firefly application-brand assets retain their separate role.
- The Journal already supplied light/dark `theme-color` values (`#f0f0e9` and
  `#1e2824`) and synchronized them with manual theme changes. This behavior is
  retained.
- The WebSite author's and BlogPosting publisher's `sameAs` links include the
  three personal sites, `https://hexly.ai/`, and configured HTTP social profiles.
  An article's AI or guest author does not receive the owner's profiles.
- `www.lizheng.blog` is assigned to the shared redirect Worker in the
  [lizheng.dev repository](https://github.com/nocoo/lizheng.dev). Its only role is
  a 301 to `https://lizheng.blog`, preserving the path and query. The blog apex
  continues to run on Railway. This also provisions the previously absent DNS
  alias and its certificate when that Worker's configuration is deployed.

## Regeneration

From the Firefly repository root:

```sh
bun scripts/create-social.tsx
bun scripts/create-touch-icon.ts
```

The social-image renderer uses the existing Playwright and Sharp dependencies,
bundled Latin fonts, and a bundled Noto Sans SC subset. Font licenses accompany
their files. Rendering is offline. After changing the card copy, regenerate the
public-text-only CJK subset with:

```sh
bun scripts/create-social.tsx --refresh-font
```

This optional refresh contacts Google Fonts with only the public image text.
The image and its metadata manifest are written together; inspect the resulting
JPEG before committing it.

## Verification

`e2e/bdd/social-preview.spec.ts` checks raw response `<head>` metadata for
Facebook, Teams (`SkypeUriPreview`), X, LinkedIn, Slack, Discord, and WhatsApp user
agents. It covers the homepage, a seeded article with a cover, and a seeded
article without a cover. It also decodes the public card, article fallback card,
and touch icons, and verifies MIME types, dimensions, HEAD responses, and caching.
All requests and seeds use the runner's isolated local D1/R2 environment.

The 15 new scenarios passed. The full browser suite passed 147 scenarios, with
47 existing conditional data skips and no failures. These user-agent simulations
verify server responses; each social platform controls when its own cached
preview is refreshed.

The release build (`bun run build`, TypeScript + Next.js webpack) also passed
against isolated local data. All 15 social-preview scenarios passed again on
that production build.
