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
        const isExternal =
          href.startsWith("http://") || href.startsWith("https://");
        const attrs = isExternal
          ? ` target="_blank" rel="noopener noreferrer"`
          : "";
        return `<a href="${href}"${attrs}>${text}</a>`;
      },

      image({ href, text }: Tokens.Image): string {
        const alt = text ? ` alt="${text}"` : "";
        return `<img src="${href}"${alt} loading="lazy">`;
      },

      code({ text, lang }: Tokens.Code): string {
        const escaped = escapeHtml(text);
        const langClass = lang ? ` class="language-${lang}"` : "";
        return `<pre><code${langClass}>${escaped}</code></pre>\n`;
      },

      html({ text }: Tokens.HTML): string {
        // Escape raw HTML to prevent XSS
        return escapeHtml(text);
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
