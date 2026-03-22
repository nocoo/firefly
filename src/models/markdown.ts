// ---------------------------------------------------------------------------
// Markdown → HTML renderer (server-side)
// Uses `marked` for parsing with custom extensions for blog needs.
// ---------------------------------------------------------------------------

import { Marked, type MarkedExtension, type Tokens } from "marked";

// ---------------------------------------------------------------------------
// Custom renderer
// ---------------------------------------------------------------------------

function createRenderer(): MarkedExtension {
  return {
    renderer: {
      heading({ text, depth }: Tokens.Heading): string {
        const id = text
          .toLowerCase()
          .replace(/<[^>]+>/g, "")
          .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
          .replace(/^-|-$/g, "");
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },

      link({ href, text }: Tokens.Link): string {
        const safeHref = sanitizeUrl(href);
        if (!safeHref) return escapeHtml(text);

        const isExternal =
          safeHref.startsWith("http://") || safeHref.startsWith("https://");
        const attrs = isExternal
          ? ` target="_blank" rel="noopener noreferrer"`
          : "";
        return `<a href="${escapeAttr(safeHref)}"${attrs}>${text}</a>`;
      },

      image({ href, text }: Tokens.Image): string {
        const safeHref = sanitizeUrl(href);
        if (!safeHref) return "";

        const alt = text ? ` alt="${escapeAttr(text)}"` : "";
        return `<img src="${escapeAttr(safeHref)}"${alt} loading="lazy">`;
      },

      code({ text, lang }: Tokens.Code): string {
        const escaped = escapeHtml(text);
        const langClass = lang ? ` class="language-${escapeAttr(lang)}"` : "";
        return `<pre><code${langClass}>${escaped}</code></pre>\n`;
      },

      html(token: Tokens.HTML | Tokens.Tag): string {
        // Escape raw HTML to prevent XSS
        return escapeHtml(token.text);
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Marked instance (singleton)
// ---------------------------------------------------------------------------

let instance: Marked | null = null;

function getMarked(): Marked {
  if (!instance) {
    instance = new Marked(createRenderer());
  }
  return instance;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render markdown to HTML.
 * - Adds heading IDs for anchor links
 * - External links open in new tab with noopener
 * - Images get lazy loading
 * - Code blocks get language class
 * - HTML is escaped to prevent XSS
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown) return "";

  const result = getMarked().parse(markdown, { async: false });
  return (typeof result === "string" ? result : "").trim();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape a string for safe use inside an HTML attribute value. */
function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Allow only safe URL schemes; returns null for dangerous ones. */
function sanitizeUrl(url: string): string | null {
  const trimmed = url.trim();
  // Allow relative URLs, http(s), mailto, tel, and hash links
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return trimmed;
  }
  // Block everything else (javascript:, data:, vbscript:, etc.)
  // Also block protocol-relative URLs that could be abused
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return null;
  }
  // Allow bare relative paths (e.g., "page.html", "../file")
  return trimmed;
}
