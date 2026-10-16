# Article Export: WeChat and Website

## MCP

`export_post` is a read-only, full-scope MCP tool at `POST /api/mcp`.
Provide exactly one of `id` or `slug`, and the required `format: "wechat"` or
`format: "website"`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "export_post",
    "arguments": { "slug": "example", "format": "wechat" }
  }
}
```

The tool returns JSON text containing `id`, `slug`, `format`, and `html`, using
the existing MCP success/error envelopes. Authentication and Origin validation
are unchanged. Restricted author tokens cannot discover or invoke this tool.
Exporting does not mutate the post, upload media, or publish anything.

### Website / X Article

Use `"arguments": { "slug": "example-post", "format": "website" }` to export
unstyled semantic HTML for pasting into an X Article. The JSON result keeps
`id`, `slug`, `format`, and `html`, and adds `title`, `url`, `cover`, and `images`:

```json
{
  "id": "post-1",
  "slug": "example-post",
  "format": "website",
  "title": "Example post",
  "url": "https://lizheng.blog/2026/10/example-post",
  "cover": "https://lizheng.blog/cover.png",
  "html": "<h2>Intro</h2>\n<p>Read <a href=\"https://example.com/\">source</a>.</p>\n<p>[图片 1]</p>",
  "images": [
    {
      "index": 1,
      "url": "https://lizheng.blog/images/diagram.png",
      "alt": "Diagram",
      "position": 2
    }
  ]
}
```

All Markdown heading levels become `h2`. HTML uses only `h2`, `p`, `ul`, `ol`,
`li`, `blockquote`, `pre`, `code`, `a`, `strong`, `em`, `hr`, and `br`; attributes
are removed except link `href`, ordered-list `start`, and list-item `value`.
Hard line breaks remain `br` elements, and list numbering is preserved.
Links stay inline, not WeChat footnotes. Raw HTML
uses the existing Markdown escaping policy. Unsupported formatting is unwrapped
to retain its text. No styling, wrapper divs, title/excerpt header, cover image,
or reference card is injected into the body.

Link protocols are validated with the browser-compatible URL parser after
removing control characters and checking whitespace-obfuscated schemes. Only
HTTP, HTTPS, and mailto links are allowed; unsafe or malformed links retain
their visible inline content without an anchor. The shared Markdown sanitizer
uses this same policy, including for WeChat rendering.

All links use browser URL serialization; relative links and fragment links
resolve against the post canonical `url`.
For `https://lizheng.blog/2026/10/example-post`, `/guide` becomes
`https://lizheng.blog/guide`, `../notes` becomes
`https://lizheng.blog/2026/notes`, and `#part` becomes
`https://lizheng.blog/2026/10/example-post#part`. Mailto links remain mailto;
spaces in URL paths and query values are percent-encoded rather than deleted.

Body images become separate `<p>[图片 N]</p>` placeholders. `index` is one-based
and follows document order; each occurrence is returned, including duplicate
URLs. `position` is the zero-based index of the containing top-level semantic
block, after HTML normalization but before image extraction. Whitespace-only
root text is not a block. A block containing only images is replaced by its
placeholder paragraphs; for mixed text or nested images, the containing block
is retained and the placeholders follow it. Multiple images from the same
source block share its position. Images inside links or lists follow this same
rule, without nesting a placeholder paragraph inside a paragraph.

`url` uses the existing UTC `postPath` convention on `https://lizheng.blog`:
`/YYYY/MM/slug` when a publication timestamp is present, otherwise `/slug`.
Exporting an unpublished post does not guarantee a future public URL. `cover`
is the absolute featured image URL, or `null` when absent. Relative cover/body
image URLs resolve against `url`; original absolute URLs are preserved. Image
URLs must be HTTP(S) without embedded credentials. The returned image list does
not include cover/reference images unless they also occur in the Markdown body.
The tool does not download or upload any images; insert them separately using
the placeholder numbers and image metadata.

## Shared Rendering

`src/lib/post-export.ts` owns the `wechat` and `website` format registry.
`renderPostExport` returns an object containing `html`, plus `images` for website
exports. The website formatter uses the browser-safe `cheerio/slim` entrypoint;
the shared renderer remains usable by the admin client without Node-only imports.

The admin WeChat clipboard action and MCP both call `renderPostExport`. For
`wechat`, it renders the
Markdown source with `renderMarkdown`, builds the cover/reference card and link
footnotes, and inlines `WECHAT_THEME_CSS` through the existing `juice` formatter.
No browser DOM is required. Cached website `content_html` is deliberately ignored
because it can contain Next.js image optimization URLs and different rendering
options. Title and excerpt remain excluded from the article body, matching the
admin copy action. Cover and reference images remain included.

## Local Draft Script

Run from the repository root on a Mac with Bun and installed dependencies:

```sh
bun scripts/wechat-draft.ts <post-id-or-slug> --dry-run
# Supply a confirmed source URL explicitly when exporting an unpublished post:
bun scripts/wechat-draft.ts <post-id-or-slug> --dry-run --source-url https://lizheng.blog/2026/10/example
```

`MCP_FIREFLY_API_KEY` must be in the environment and must have full scope.
WeChat credentials come from `WECHAT_APPID` / `WECHAT_APPSECRET` in the environment
or `~/.config/wechat/credentials.env`:

```sh
export WECHAT_APPID='your-app-id'
export WECHAT_APPSECRET='your-app-secret'
```

Environment values take precedence for each variable. The script parses this
file as dotenv data; it never executes shell commands from the file. Keep it
outside the repository and restrict its permissions (for example, `0600`).

The script calls the production Firefly MCP endpoint using Bearer authentication,
the required Accept header, and `Origin: https://lizheng.blog`. It fetches the post
with `get_post` and uses `export_post` when listed by the deployed server. If that
tool is absent, it renders locally using the same shared formatter. Authentication,
validation, and export failures do not trigger a local fallback.

Dry-run downloads and validates all distinct article images and the featured
cover, and obtains an access token through `POST /cgi-bin/stable_token` with
`force_refresh: false`. It does not upload images or call `draft/add`. It writes
the exact exported HTML, with original image URLs, to an `article.html` file
(`0600`) in a new temporary directory (`0700`), and prints its path. This file may
contain private post content; remove it when no longer needed. Dry-run needs
valid WeChat credentials and any IP allowlisting required by that account.

Without `--dry-run`, the script uploads each distinct body image (including
cover/reference images present in the HTML) through `media/uploadimg`, rewrites
only image source attributes, uploads the featured cover separately through
`material/add_material?type=image`, then creates one draft through `draft/add`.
It prints the resulting `media_id`. A featured image is required. Images use
HTTP(S) without embedded credentials. Downloads are byte-counted while streaming;
the stream is cancelled immediately above 20 MiB, even without Content-Length.
Sharp fully decodes images with a pixel limit; valid PNG/JPEG below 1 MiB are preserved.
Other images are converted to JPEG (at most 1600 x 1600, first frame for animations) and rejected
if still too large for body-image upload. All images are preflighted before any
WeChat writes. Alternate image sources are removed after URL replacement.

Draft fields use the post title, the fixed author `李老板`, and the excerpt as
the digest. `human_name` is ignored; there is no `--author` flag.
Before any downloads or uploads, the
script enforces the [draft/add limits](https://developers.weixin.qq.com/doc/service/api/draftbox/draftmanage/api_draft_add):
title <=32, author <=16, digest <=120, and rendered HTML <20,000 Unicode code
points. Oversized fields fail explicitly; no metadata is silently truncated.
HTML is checked again after uploaded image URLs replace the originals; URL
expansion can still cause failure after body-image uploads, but before cover
material or draft creation.

Only a published post with a publication timestamp gets an automatic
`content_source_url`. A server-provided `canonical_url` takes precedence;
otherwise the script uses `/YYYY/MM/slug` in UTC. Shared site URL generation
and both article route date checks use UTC, matching SQL archive queries.
Unpublished or undated posts omit the source field: publishing can assign the
current timestamp, so a future URL cannot be predicted. `--source-url <url>`
explicitly overrides this behavior with an absolute HTTP(S) URL without embedded
credentials, without changing how original image URLs are resolved.

Neither credentials nor access tokens nor raw upstream error messages are
logged. Credential-bearing requests reject redirects and have timeouts.

There are no publishing, mass-send, or freepublish calls. Uploads and draft
creation are not retried automatically: an interrupted request may already have
created remote state. Inspect the WeChat account before rerunning after a write
failure; previously uploaded materials are not deleted automatically.
