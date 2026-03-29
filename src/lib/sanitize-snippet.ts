/**
 * Sanitize FTS5 snippet HTML for safe rendering.
 *
 * - Strips all HTML tags except <mark> and </mark>
 * - Collapses spaces between CJK characters (segmentation artifact)
 * - Handles <mark> tags between adjacent CJK characters
 */
export function sanitizeSnippet(html: string): string {
  // Strip all tags except <mark> and </mark>
  let s = html.replace(/<(?!\/?mark\b)[^>]+>/gi, "");
  // Collapse spaces between CJK characters (segmentation artifact)
  // Handles mark tags in between: "边缘</mark> <mark>计算" → "边缘</mark><mark>计算"
  // Loop because each replace handles one adjacent pair
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(
      /([\u4e00-\u9fff])(<\/mark>)?\s+(<mark>)?([\u4e00-\u9fff])/g,
      "$1$2$3$4",
    );
  }
  return s;
}
