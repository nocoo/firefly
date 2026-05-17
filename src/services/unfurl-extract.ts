// ---------------------------------------------------------------------------
// HTML metadata extraction — OG tags, body text (regex-based, no DOM parser)
// ---------------------------------------------------------------------------

const MAX_UNFURL_BODY_CHARS = 3000;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

/**
 * Look up <meta {attr}="{key}" content="..."> handling both attribute orders
 * and both quote styles. Returns the first match decoded, or null.
 */
function matchMetaContent(
  html: string,
  attr: "property" | "name",
  key: string,
): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content="([^"]*)"`, "i"),
    new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content='([^']*)'`, "i"),
    new RegExp(`<meta[^>]+content="([^"]*)"[^>]+${attr}=["']${key}["']`, "i"),
    new RegExp(`<meta[^>]+content='([^']*)'[^>]+${attr}=["']${key}["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }
  return null;
}

interface OgMetadata {
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  pageTitle: string | null;
}

export function extractOgMetadata(html: string): OgMetadata {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const pageTitle = titleMatch?.[1]
    ? decodeHtmlEntities(titleMatch[1].trim())
    : null;

  return {
    ogTitle: matchMetaContent(html, "property", "og:title"),
    ogDescription:
      matchMetaContent(html, "property", "og:description") ??
      matchMetaContent(html, "name", "description"),
    ogImage: matchMetaContent(html, "property", "og:image"),
    pageTitle,
  };
}

/** Strip tags + decode entities + collapse whitespace + truncate. */
export function extractBodyText(html: string): string {
  // Remove <script>, <style>, <noscript> blocks
  let text = html.replace(
    /<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );

  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode common entities
  text = decodeHtmlEntities(text);

  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Truncate to MAX_UNFURL_BODY_CHARS
  if (text.length > MAX_UNFURL_BODY_CHARS) {
    text = text.slice(0, MAX_UNFURL_BODY_CHARS);
  }

  return text;
}
