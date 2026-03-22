// ---------------------------------------------------------------------------
// Post model — pure business logic (no React, no DB)
// ---------------------------------------------------------------------------

const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;
const WORDS_PER_MINUTE = 200;
const CJK_CHARS_PER_MINUTE = 300;

// ---------------------------------------------------------------------------
// slugify — convert title to URL-safe slug
// ---------------------------------------------------------------------------

/**
 * Convert a string to a URL-safe slug.
 * - Lowercases ASCII letters
 * - Preserves CJK characters
 * - Replaces spaces and special chars with dashes
 * - Collapses consecutive dashes, trims edges
 */
export function slugify(input: string): string {
  if (!input) return "";

  return (
    input
      .trim()
      .toLowerCase()
      // Remove HTML-like characters and ampersands
      .replace(/[<>&]/g, "")
      // Replace apostrophes (don't leave a dash)
      .replace(/['']/g, "")
      // Replace non-alphanumeric, non-CJK, non-dash chars with dash
      .replace(/[^a-z0-9\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff-]/g, "-")
      // Collapse consecutive dashes
      .replace(/-{2,}/g, "-")
      // Trim leading/trailing dashes
      .replace(/^-|-$/g, "")
  );
}

// ---------------------------------------------------------------------------
// readingTime — estimate reading time in minutes
// ---------------------------------------------------------------------------

/**
 * Estimate reading time for a piece of content.
 * - English: ~200 words per minute
 * - CJK: ~300 characters per minute
 * - Always returns at least 1
 */
export function readingTime(content: string): number {
  if (!content) return 1;

  // Strip markdown/code formatting for counting
  const stripped = stripMarkdown(content);

  // Count CJK characters
  const cjkMatches = stripped.match(CJK_RE);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  // Remove CJK characters, then count words
  const withoutCjk = stripped.replace(CJK_RE, " ");
  const words = withoutCjk
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const wordCount = words.length;

  const minutes = wordCount / WORDS_PER_MINUTE + cjkCount / CJK_CHARS_PER_MINUTE;

  return Math.max(1, Math.ceil(minutes));
}

// ---------------------------------------------------------------------------
// excerptFromContent — generate excerpt from markdown content
// ---------------------------------------------------------------------------

const DEFAULT_EXCERPT_LENGTH = 160;

/**
 * Extract a plain-text excerpt from markdown content.
 * - Strips markdown, HTML, code blocks
 * - Collapses whitespace
 * - Truncates at word boundary
 */
export function excerptFromContent(
  content: string,
  maxLength: number = DEFAULT_EXCERPT_LENGTH,
): string {
  if (!content) return "";

  const plain = stripMarkdown(content).trim();

  if (plain.length <= maxLength) return plain;

  // Truncate at word boundary
  const truncated = plain.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  return lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Strip markdown formatting to plain text.
 * Handles: headings, bold, italic, links, images, code blocks, inline code, HTML tags.
 */
function stripMarkdown(md: string): string {
  return (
    md
      // Remove code blocks (``` ... ```)
      .replace(/```[\s\S]*?```/g, "")
      // Remove inline code
      .replace(/`[^`]*`/g, "")
      // Remove images ![alt](url)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      // Convert links [text](url) → text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // Remove heading markers
      .replace(/^#{1,6}\s+/gm, "")
      // Remove bold/italic markers
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
      .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
      // Remove HTML tags
      .replace(/<[^>]+>/g, "")
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // Collapse whitespace
      .replace(/\n{2,}/g, " ")
      .replace(/\n/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}
