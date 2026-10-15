# WeChat Article Export

## MCP

`export_post` is a read-only, full-scope MCP tool at `POST /api/mcp`.
Provide exactly one of `id` or `slug`, and the required `format: "wechat"`:

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

## Shared Rendering

`src/lib/post-export.ts` owns the format registry. Only `wechat` is implemented;
`website` (for a future X Article workflow) is not accepted. Adding a format
requires registering its renderer and updating `POST_EXPORT_FORMATS`.

The admin clipboard action and MCP both call `renderPostExport`. It renders the
Markdown source with `renderMarkdown`, builds the cover/reference card and link
footnotes, and inlines `WECHAT_THEME_CSS` through the existing `juice` formatter.
No browser DOM is required. Cached website `content_html` is deliberately ignored
because it can contain Next.js image optimization URLs and different rendering
options. Title and excerpt remain excluded from the article body, matching the
admin copy action. Cover and reference images remain included.
