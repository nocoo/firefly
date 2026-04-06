// ---------------------------------------------------------------------------
// Markdown → HTML renderer (server-side)
// Uses `marked` for parsing with custom extensions for blog needs.
// ---------------------------------------------------------------------------

import { Marked, type MarkedExtension, type Tokens } from "marked";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RenderMarkdownOptions {
  /** Rewrite <img> src to /_next/image proxy with srcset/sizes. Default: false */
  optimizeImages?: boolean;
  /** Post title used as part of the alt text fallback for images without alt. */
  postTitle?: string;
}

// ---------------------------------------------------------------------------
// Image optimisation constants
// ---------------------------------------------------------------------------

/**
 * Extract hostname from R2_PUBLIC_URL for image optimization whitelist.
 * Images from this domain are proxied through /_next/image for optimization.
 */
const OPTIMIZABLE_HOSTS = (() => {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) return [];
  try {
    return [new URL(url).hostname];
  } catch {
    return [];
  }
})();

/** Subset of Next.js default deviceSizes suitable for blog content. */
const SRCSET_WIDTHS = [640, 828, 1080, 1920];

/** Default width for the `src` attribute (fallback for browsers without srcset). */
const DEFAULT_WIDTH = 1080;

/** Quality parameter for the Next.js image proxy. */
const IMAGE_QUALITY = 75;

/** `sizes` attribute matching the blog content column width. */
const CONTENT_SIZES = "(max-width: 900px) 100vw, min(75vw, 1000px)";

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

/** Extract filename (without extension) from a URL for use as alt text fallback. */
function filenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url, "https://x").pathname;
    const filename = pathname.split("/").pop() ?? "";
    return filename.replace(/\.[^.]+$/, "");
  } catch {
    return "";
  }
}

/** Build alt text fallback: "Post Title - filename" or just one of them. */
function altFallback(url: string, postTitle?: string): string {
  const filename = filenameFromUrl(url);
  if (postTitle && filename) return `${postTitle} - ${filename}`;
  return postTitle || filename || "";
}

/** Check whether a URL points to one of our optimisable domains. */
function isOptimizableUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return OPTIMIZABLE_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}

/** Build a /_next/image proxy URL for a given source and width. */
function nextImageUrl(src: string, width: number): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${IMAGE_QUALITY}`;
}

// ---------------------------------------------------------------------------
// Custom renderer
// ---------------------------------------------------------------------------

function createRenderer(optimizeImages: boolean, postTitle?: string): MarkedExtension {
  return {
    renderer: {
      heading({ tokens, depth }: Tokens.Heading): string {
        // Use parseInline to render inline tokens through our custom html()
        // renderer, which escapes dangerous HTML tags in the text content.
        const rendered = this.parser.parseInline(tokens);
        const id = rendered
          .toLowerCase()
          .replace(/<[^>]+>/g, "")
          .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
          .replace(/^-|-$/g, "");
        return `<h${depth} id="${id}">${rendered}</h${depth}>\n`;
      },

      link({ href, tokens }: Tokens.Link): string {
        const safeHref = sanitizeUrl(href);
        // Render inline tokens (bold, code, etc.) through parseInline so
        // that any inline HTML goes through our html() escaper.
        const rendered = this.parser.parseInline(tokens);
        if (!safeHref) return rendered;

        const isExternal =
          safeHref.startsWith("http://") || safeHref.startsWith("https://");
        const attrs = isExternal
          ? ` target="_blank" rel="noopener noreferrer"`
          : "";
        return `<a href="${escapeAttr(safeHref)}"${attrs}>${rendered}</a>`;
      },

      image({ href, text, title }: Tokens.Image): string {
        const safeHref = sanitizeUrl(href);
        if (!safeHref) return "";

        // alt: explicit text > title > filename extracted from URL
        const altText = text || title || altFallback(safeHref, postTitle);
        const alt = ` alt="${escapeAttr(altText)}"`;
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";

        // Optimised mode: rewrite internal images to /_next/image proxy
        if (optimizeImages && isOptimizableUrl(safeHref)) {
          const escapedOriginal = escapeAttr(safeHref);
          const src = escapeAttr(nextImageUrl(safeHref, DEFAULT_WIDTH));
          const srcset = SRCSET_WIDTHS.map(
            (w) => `${escapeAttr(nextImageUrl(safeHref, w))} ${w}w`,
          ).join(", ");

          return (
            `<img src="${src}"` +
            ` srcset="${srcset}"` +
            ` sizes="${CONTENT_SIZES}"` +
            `${alt}${titleAttr}` +
            ` loading="lazy"` +
            ` decoding="async"` +
            ` data-original-src="${escapedOriginal}">`
          );
        }

        return `<img src="${escapeAttr(safeHref)}"${alt}${titleAttr} loading="lazy">`;
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
// Marked instances (singletons)
// ---------------------------------------------------------------------------

let defaultInstance: Marked | null = null;
let optimizedInstance: Marked | null = null;

function getMarked(optimizeImages: boolean, postTitle?: string): Marked {
  // When postTitle is provided, create a fresh instance (alt fallback is per-post)
  if (postTitle) {
    return new Marked(createRenderer(optimizeImages, postTitle));
  }
  if (optimizeImages) {
    if (!optimizedInstance) {
      optimizedInstance = new Marked(createRenderer(true));
    }
    return optimizedInstance;
  }
  if (!defaultInstance) {
    defaultInstance = new Marked(createRenderer(false));
  }
  return defaultInstance;
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
 *
 * When `options.optimizeImages` is true, internal image URLs are rewritten to
 * use the Next.js `/_next/image` proxy with `srcset`/`sizes` for responsive
 * delivery and automatic WebP/AVIF conversion. External URLs are untouched.
 */
export function renderMarkdown(
  markdown: string,
  options?: RenderMarkdownOptions,
): string {
  if (!markdown) return "";

  const optimize = options?.optimizeImages ?? false;
  const result = getMarked(optimize, options?.postTitle).parse(markdown, { async: false });
  return (typeof result === "string" ? result : "").trim();
}
