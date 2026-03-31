#!/usr/bin/env bun
/**
 * 07-convert-content-to-markdown.ts — Convert post content to Markdown.
 *
 * Handles two formats:
 * 1. Gutenberg blocks (<!-- wp:xxx --> ... <!-- /wp:xxx -->) — 49 posts
 * 2. Classic HTML (raw <a>, <img>, <strong>, etc.) — 698 posts
 *
 * Rewrites image URLs from lizheng.me → b.no.mt
 * Updates all posts in D1 via Worker proxy.
 *
 * Usage: bun scripts/migrations/07-convert-content-to-markdown.ts [--dry-run]
 */

import { createDb } from "../../src/lib/db";

// biome-ignore lint: allow require for dotenv
require("dotenv").config();

const WORKER_URL = process.env.WORKER_URL!;
const WORKER_SECRET = process.env.WORKER_SECRET!;

if (!WORKER_URL || !WORKER_SECRET) {
  console.error("Missing WORKER_URL or WORKER_SECRET");
  process.exit(1);
}

const db = createDb(WORKER_URL, WORKER_SECRET);
const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// HTML entity decoding
// ---------------------------------------------------------------------------

function decodeEntities(html: string): string {
  return html
    .replace(/&#91;/g, "[")
    .replace(/&#93;/g, "]")
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, "\u201C")
    .replace(/&#8221;/g, "\u201D")
    .replace(/&#8230;/g, "…")
    .replace(/&#038;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

// ---------------------------------------------------------------------------
// Strip HTML tags (for inline cleanup)
// ---------------------------------------------------------------------------

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

// ---------------------------------------------------------------------------
// Rewrite image URLs
// ---------------------------------------------------------------------------

function rewriteImageUrls(text: string): string {
  return text.replace(
    /https?:\/\/lizheng\.me\/wp-content\/uploads\//g,
    "https://b.no.mt/wp-content/uploads/",
  );
}

// ---------------------------------------------------------------------------
// Convert inline HTML to Markdown
// ---------------------------------------------------------------------------

function convertInlineHtml(html: string): string {
  let result = html;

  // Bold: <strong>text</strong> or <b>text</b>
  result = result.replace(/<(?:strong|b)>(.*?)<\/(?:strong|b)>/gs, "**$1**");

  // Italic: <em>text</em> or <i>text</i>
  result = result.replace(/<(?:em|i)>(.*?)<\/(?:em|i)>/gs, "*$1*");

  // Strikethrough: <del>text</del> or <s>text</s>
  result = result.replace(/<(?:del|s)>(.*?)<\/(?:del|s)>/gs, "~~$1~~");

  // Code: <code>text</code> (inline)
  result = result.replace(/<code>(.*?)<\/code>/gs, "`$1`");

  // Links: <a href="url">text</a>
  result = result.replace(
    /<a\s[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gs,
    (_, url, text) => `[${stripTags(text)}](${url})`,
  );

  // Images: <img src="url" alt="text" .../>
  result = result.replace(
    /<img\s[^>]*src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*\/?>/gs,
    (match, src, alt) => {
      // Also try to extract alt if it comes before src
      const altMatch = match.match(/alt=["']([^"']*?)["']/);
      const altText = alt || altMatch?.[1] || "";
      return `![${altText}](${src})`;
    },
  );

  // <br> → newline
  result = result.replace(/<br\s*\/?>/g, "\n");

  // <span ...>text</span> → text
  result = result.replace(/<\/?span[^>]*>/g, "");

  return result;
}

// ---------------------------------------------------------------------------
// Gutenberg block converter
// ---------------------------------------------------------------------------

function convertGutenberg(content: string): string {
  const lines: string[] = [];

  // Process the content by matching blocks sequentially
  let remaining = content;

  while (remaining.length > 0) {
    // Try to match an opening block comment
    const blockMatch = remaining.match(
      /^([\s\S]*?)<!-- wp:(\S+?)(?:\s+(\{[^}]*\}))?\s*(?:\/)?-->/,
    );

    if (!blockMatch) {
      // No more blocks — treat rest as text
      const text = remaining.trim();
      if (text) {
        lines.push(convertInlineHtml(decodeEntities(stripTags(text))));
      }
      break;
    }

    // Any text before the block
    const before = blockMatch[1].trim();
    if (before) {
      const cleaned = before.replace(/<!--.*?-->/g, "").trim();
      if (cleaned) {
        lines.push(convertInlineHtml(decodeEntities(stripTags(cleaned))));
      }
    }

    const blockType = blockMatch[2];
    const blockAttrs = blockMatch[3] ? JSON.parse(blockMatch[3]) : {};
    const matchEnd = blockMatch.index! + blockMatch[0].length;

    // Self-closing block (like <!-- wp:separator /-->)
    if (blockMatch[0].endsWith("/-->")) {
      if (blockType === "separator") {
        lines.push("", "---", "");
      }
      remaining = remaining.slice(matchEnd);
      continue;
    }

    // Find the closing tag
    const closeTag = `<!-- /wp:${blockType} -->`;
    const closeIdx = remaining.indexOf(closeTag, matchEnd);

    if (closeIdx === -1) {
      // No closing tag — skip this block
      remaining = remaining.slice(matchEnd);
      continue;
    }

    const blockContent = remaining.slice(matchEnd, closeIdx).trim();
    remaining = remaining.slice(closeIdx + closeTag.length);

    // Convert by block type
    switch (blockType) {
      case "paragraph": {
        const text = decodeEntities(
          convertInlineHtml(
            blockContent.replace(/<\/?p[^>]*>/g, ""),
          ),
        ).trim();
        if (text) {
          lines.push(text, "");
        }
        break;
      }

      case "heading": {
        const levelMatch = blockContent.match(/<h(\d)/);
        const level = levelMatch ? parseInt(levelMatch[1], 10) : 2;
        const text = decodeEntities(stripTags(blockContent)).trim();
        if (text) {
          lines.push("", "#".repeat(level) + " " + text, "");
        }
        break;
      }

      case "list": {
        const ordered = blockAttrs.ordered === true;
        const items = blockContent.match(/<li>([\s\S]*?)<\/li>/g) ?? [];
        let idx = 1;
        for (const item of items) {
          const text = decodeEntities(
            convertInlineHtml(item.replace(/<\/?li>/g, "").replace(/<!--.*?-->/g, "")),
          ).trim();
          if (text) {
            const prefix = ordered ? `${idx}. ` : "- ";
            lines.push(prefix + text);
            idx++;
          }
        }
        lines.push("");
        break;
      }

      case "quote": {
        // Quote may contain nested paragraph blocks
        const inner = convertGutenberg(blockContent);
        const quoteLines = inner.split("\n").filter((l) => l.trim() !== "");
        for (const line of quoteLines) {
          lines.push("> " + line);
        }
        lines.push("");
        break;
      }

      case "code": {
        // Extract content from <pre><code>...</code></pre>
        const codeMatch = blockContent.match(
          /<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/,
        );
        const code = codeMatch
          ? decodeEntities(codeMatch[1])
          : decodeEntities(stripTags(blockContent));
        lines.push("```", code, "```", "");
        break;
      }

      case "image": {
        const srcMatch = blockContent.match(/src=["']([^"']+)["']/);
        const altMatch = blockContent.match(/alt=["']([^"']*?)["']/);
        const captionMatch = blockContent.match(
          /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/,
        );

        const src = srcMatch?.[1] ?? "";
        const alt = altMatch?.[1] ?? captionMatch?.[1] ?? "";
        const caption = captionMatch
          ? decodeEntities(stripTags(captionMatch[1])).trim()
          : "";

        if (src) {
          lines.push(`![${alt}](${rewriteImageUrls(src)})`);
          if (caption && caption !== alt) {
            lines.push(`*${caption}*`);
          }
          lines.push("");
        }
        break;
      }

      case "separator": {
        lines.push("", "---", "");
        break;
      }

      case "table": {
        const result = convertHtmlTable(blockContent);
        if (result) {
          lines.push(result, "");
        }
        break;
      }

      case "list-item": {
        // list-item is handled inside list
        break;
      }

      default: {
        // Unknown block — try to extract text
        const text = decodeEntities(
          convertInlineHtml(stripTags(blockContent)),
        ).trim();
        if (text) {
          lines.push(text, "");
        }
      }
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ---------------------------------------------------------------------------
// HTML table → Markdown table
// ---------------------------------------------------------------------------

function convertHtmlTable(html: string): string | null {
  const rows: string[][] = [];

  // Extract header rows
  const theadMatch = html.match(/<thead>([\s\S]*?)<\/thead>/);
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);

  function extractRows(section: string): string[][] {
    const result: string[][] = [];
    const rowMatches = section.match(/<tr>([\s\S]*?)<\/tr>/g) ?? [];
    for (const row of rowMatches) {
      const cells = (row.match(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/g) ?? []).map(
        (cell) => decodeEntities(stripTags(cell)).trim(),
      );
      if (cells.length > 0) result.push(cells);
    }
    return result;
  }

  if (theadMatch) rows.push(...extractRows(theadMatch[1]));
  if (tbodyMatch) rows.push(...extractRows(tbodyMatch[1]));

  // Fallback: no thead/tbody
  if (rows.length === 0) {
    rows.push(...extractRows(html));
  }

  if (rows.length === 0) return null;

  // Build markdown table
  const colCount = Math.max(...rows.map((r) => r.length));
  const lines: string[] = [];

  // Header row
  const header = rows[0] ?? [];
  lines.push("| " + header.map((c) => c || " ").join(" | ") + " |");
  lines.push("| " + header.map(() => "---").join(" | ") + " |");

  // Data rows
  for (let i = 1; i < rows.length; i++) {
    const padded = rows[i];
    while (padded.length < colCount) padded.push("");
    lines.push("| " + padded.join(" | ") + " |");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Classic HTML → Markdown (for posts without Gutenberg blocks)
// ---------------------------------------------------------------------------

function convertClassicHtml(content: string): string {
  let result = content;

  // Rewrite image URLs first
  result = rewriteImageUrls(result);

  // Headings
  result = result.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
  result = result.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
  result = result.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
  result = result.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n");

  // Blockquote
  result = result.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
    const text = inner.replace(/<\/?p[^>]*>/g, "").trim();
    return "\n" + text.split("\n").map((l: string) => "> " + l.trim()).join("\n") + "\n";
  });

  // Code blocks: <pre><code>...</code></pre>
  result = result.replace(
    /<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/gi,
    (_, code) => "\n```\n" + decodeEntities(code) + "\n```\n",
  );

  // Ordered lists
  result = result.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
    const items = inner.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
    return "\n" + items.map((item: string, i: number) => {
      const text = convertInlineHtml(item.replace(/<\/?li[^>]*>/g, "")).trim();
      return `${i + 1}. ${text}`;
    }).join("\n") + "\n";
  });

  // Unordered lists
  result = result.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => {
    const items = inner.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
    return "\n" + items.map((item: string) => {
      const text = convertInlineHtml(item.replace(/<\/?li[^>]*>/g, "")).trim();
      return `- ${text}`;
    }).join("\n") + "\n";
  });

  // Paragraphs
  result = result.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n");

  // Horizontal rule
  result = result.replace(/<hr[^>]*\/?>/gi, "\n---\n");

  // Convert remaining inline HTML
  result = convertInlineHtml(result);

  // Decode entities
  result = decodeEntities(result);

  // Clean up remaining HTML tags (non-essential)
  result = result.replace(/<\/?(?:div|figure|figcaption|summary|details|param|embed|object)[^>]*>/gi, "");

  // Clean up whitespace
  result = result.replace(/\n{3,}/g, "\n\n").trim();

  return result;
}

// ---------------------------------------------------------------------------
// Main conversion logic
// ---------------------------------------------------------------------------

function convertContent(content: string): string {
  if (!content || content.trim() === "") return "";

  const isGutenberg = content.includes("<!-- wp:");

  let markdown: string;
  if (isGutenberg) {
    markdown = convertGutenberg(content);
  } else {
    markdown = convertClassicHtml(content);
  }

  // Final cleanup: rewrite any remaining image URLs
  markdown = rewriteImageUrls(markdown);

  // Strip any remaining WP comments
  markdown = markdown.replace(/<!--.*?-->/gs, "");

  // Clean up whitespace
  markdown = markdown.replace(/\n{3,}/g, "\n\n").trim();

  return markdown;
}

// ---------------------------------------------------------------------------
// Run migration
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Converting post content to Markdown ${DRY_RUN ? "(DRY RUN)" : ""}\n`);

  // Fetch all posts
  let offset = 0;
  const pageSize = 100;
  let totalConverted = 0;
  let totalSkipped = 0;
  let totalGutenberg = 0;
  let totalClassic = 0;

  while (true) {
    const result = await db.query<{
      id: string;
      title: string;
      content: string;
      slug: string;
    }>(
      `SELECT id, title, content, slug FROM posts ORDER BY created_at ASC LIMIT ? OFFSET ?`,
      [pageSize, offset],
    );

    if (result.results.length === 0) break;

    for (const post of result.results) {
      const original = post.content ?? "";

      // Skip empty content
      if (!original.trim()) {
        totalSkipped++;
        continue;
      }

      // Skip if already markdown (no HTML tags, no WP blocks)
      const hasHtml = /<[a-z][^>]*>/i.test(original);
      const hasWpBlocks = original.includes("<!-- wp:");
      if (!hasHtml && !hasWpBlocks) {
        totalSkipped++;
        continue;
      }

      const isGutenberg = hasWpBlocks;
      const markdown = convertContent(original);

      if (isGutenberg) totalGutenberg++;
      else totalClassic++;

      if (!DRY_RUN) {
        await db.execute(
          "UPDATE posts SET content = ? WHERE id = ?",
          [markdown, post.id],
        );
      }

      totalConverted++;
      if (totalConverted % 50 === 0) {
        console.log(`  Converted ${totalConverted}...`);
      }
    }

    offset += pageSize;
  }

  console.log(`\n✓ Content conversion complete!`);
  console.log(`  Converted: ${totalConverted} (${totalGutenberg} Gutenberg, ${totalClassic} classic)`);
  console.log(`  Skipped: ${totalSkipped} (empty or already markdown)`);

  if (DRY_RUN) {
    console.log("\n⚠ DRY RUN — no changes written to D1");
  }
}

await main();
