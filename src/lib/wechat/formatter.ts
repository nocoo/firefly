import juice from "juice";
import { WECHAT_THEME_CSS } from "./theme";

export interface WeChatPostMetadata {
  title?: string | undefined;
  excerpt?: string | undefined;
  featuredImage?: string | undefined;
  referenceUrl?: string | undefined;
  referenceTitle?: string | undefined;
  referenceDescription?: string | undefined;
  referenceImage?: string | undefined;
}

export interface ConvertWechatOptions {
  referenceTitle?: string | undefined;
}

interface FootnoteLink {
  id: number;
  href: string;
  text: string;
}

/**
 * Decode basic HTML entities that marked generates inside attribute values and text
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Check if the link should skip being converted into a footnote:
 * e.g., anchor links (#), internal paths (/), or mp.weixin.qq.com links (which WeChat allows directly).
 */
function shouldSkipFootnote(href: string): boolean {
  if (
    href.startsWith("#") ||
    href.startsWith("/") ||
    href.startsWith("./") ||
    href.startsWith("../")
  ) {
    return true;
  }
  try {
    const url = new URL(href);
    return url.hostname === "mp.weixin.qq.com";
  } catch {
    return false;
  }
}

/**
 * Transform standard HTML links into WeChat-friendly footnotes:
 * External links aren't clickable in WeChat MP except official domains,
 * so we convert [text](url) into text^[1] and add a reference section at the bottom.
 */
export function convertLinksToFootnotes(
  html: string,
  referenceTitle = "参考链接",
): string {
  const links: FootnoteLink[] = [];
  const hrefToId = new Map<string, number>();
  let counter = 1;

  // Regex matching <a ...href="..."...>...</a>
  const transformed = html.replace(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
    (match, attrs, content) => {
      const hrefMatch = attrs.match(/href=(["'])(.*?)\1/i);
      const rawHrefAttr = hrefMatch ? hrefMatch[2].trim() : "";
      // Decode HTML entities from attribute value so that URLs like ?a=1&amp;b=2 become ?a=1&b=2
      const decodedHref = decodeHtmlEntities(rawHrefAttr);

      if (!decodedHref || shouldSkipFootnote(decodedHref)) {
        // Keep as-is or stripped for internal/empty
        return match;
      }

      let id = hrefToId.get(decodedHref);
      if (!id) {
        id = counter++;
        hrefToId.set(decodedHref, id);
        // Strip tags from content for clean text and decode entities
        const plainText = decodeHtmlEntities(content.replace(/<[^>]+>/g, "").trim()) || decodedHref;
        links.push({ id, href: decodedHref, text: plainText });
      }

      return `<span>${content}</span><sup class="wechat-footnote-ref">[${id}]</sup>`;
    },
  );

  if (links.length === 0) {
    return transformed;
  }

  const footnotesHtml = [
    `<section class="wechat-footnotes">`,
    `<h4>${escapeHtml(referenceTitle)}</h4>`,
    `<ol>`,
    ...links.map(
      (link) =>
        `<li><span>${escapeHtml(link.text)}: </span><span style="word-break: break-all;">${escapeHtml(link.href)}</span></li>`,
    ),
    `</ol>`,
    `</section>`,
  ].join("");

  return transformed + footnotesHtml;
}

/**
 * Build the full WeChat article structure including optional title, cover, excerpt,
 * reference card, and the body HTML.
 */
export function buildWeChatStructure(
  contentHtml: string,
  meta?: WeChatPostMetadata,
  options?: ConvertWechatOptions,
): string {
  const parts: string[] = [];

  if (meta?.featuredImage) {
    parts.push(
      `<div class="wechat-featured-image"><img src="${escapeHtml(meta.featuredImage)}" alt="${escapeHtml(meta.title || "封面")}"/></div>`,
    );
  }

  if (meta?.title) {
    parts.push(`<h1 class="wechat-post-title">${escapeHtml(meta.title)}</h1>`);
  }

  if (meta?.excerpt) {
    parts.push(
      `<div class="wechat-post-excerpt">${escapeHtml(meta.excerpt)}</div>`,
    );
  }

  if (meta?.referenceUrl) {
    const imageHtml = meta.referenceImage
      ? `<div class="wechat-reference-img"><img src="${escapeHtml(meta.referenceImage)}" alt="${escapeHtml(meta.referenceTitle || "")}"/></div>`
      : "";
    parts.push(
      `<div class="wechat-reference-card">` +
        imageHtml +
        `<div class="wechat-reference-body">` +
        `<div class="wechat-reference-title">${escapeHtml(meta.referenceTitle || meta.referenceUrl)}</div>` +
        (meta.referenceDescription
          ? `<div class="wechat-reference-desc">${escapeHtml(meta.referenceDescription)}</div>`
          : "") +
        `<div class="wechat-reference-url">${escapeHtml(meta.referenceUrl)}</div>` +
        `</div>` +
        `</div>`,
    );
  }

  const processedContent = convertLinksToFootnotes(
    contentHtml,
    options?.referenceTitle,
  );
  parts.push(processedContent);

  return parts.join("\n");
}

/**
 * Inline CSS into WeChat-compatible HTML using juice.
 * Wraps content in `<section id="bm-md">` and applies WECHAT_THEME_CSS styles directly on element style="...".
 */
export function inlineWeChatHtml(
  rawHtml: string,
  meta?: WeChatPostMetadata,
  options?: ConvertWechatOptions,
): string {
  const fullHtml = buildWeChatStructure(rawHtml, meta, options);
  const wrapped = `<section id="bm-md">${fullHtml}</section>`;

  try {
    return juice.inlineContent(wrapped, WECHAT_THEME_CSS, {
      inlinePseudoElements: true,
      preserveImportant: true,
    });
  } catch (err) {
    console.error("Failed to inline WeChat HTML styles:", err);
    return wrapped;
  }
}
