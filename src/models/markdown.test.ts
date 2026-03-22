import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown";

// ---------------------------------------------------------------------------
// renderMarkdown()
// ---------------------------------------------------------------------------

describe("renderMarkdown", () => {
  // --- Headings ---
  it("renders headings", () => {
    expect(renderMarkdown("# Hello")).toContain("<h1");
    expect(renderMarkdown("## Hello")).toContain("<h2");
    expect(renderMarkdown("### Hello")).toContain("<h3");
  });

  it("adds id attributes to headings for anchor links", () => {
    const html = renderMarkdown("## My Section");
    expect(html).toContain('id="my-section"');
  });

  // --- Inline formatting ---
  it("renders bold text", () => {
    const html = renderMarkdown("**bold**");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("renders italic text", () => {
    const html = renderMarkdown("*italic*");
    expect(html).toContain("<em>italic</em>");
  });

  it("renders inline code", () => {
    const html = renderMarkdown("`code`");
    expect(html).toContain("<code>code</code>");
  });

  // --- Links ---
  it("renders links with target and rel attributes", () => {
    const html = renderMarkdown("[Google](https://google.com)");
    expect(html).toContain('href="https://google.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("renders internal links without target=_blank", () => {
    const html = renderMarkdown("[About](/about)");
    expect(html).toContain('href="/about"');
    expect(html).not.toContain('target="_blank"');
  });

  // --- Images ---
  it("renders images with alt text and lazy loading", () => {
    const html = renderMarkdown("![Alt text](https://example.com/img.jpg)");
    expect(html).toContain('src="https://example.com/img.jpg"');
    expect(html).toContain('alt="Alt text"');
    expect(html).toContain('loading="lazy"');
  });

  // --- Code blocks ---
  it("renders fenced code blocks", () => {
    const md = "```js\nconst x = 1;\n```";
    const html = renderMarkdown(md);
    expect(html).toContain("<pre>");
    expect(html).toContain("<code");
    expect(html).toContain("const x = 1;");
  });

  it("adds language class to code blocks", () => {
    const md = "```typescript\nconst x: number = 1;\n```";
    const html = renderMarkdown(md);
    expect(html).toMatch(/class="[^"]*language-typescript[^"]*"/);
  });

  // --- Lists ---
  it("renders unordered lists", () => {
    const md = "- Item 1\n- Item 2\n- Item 3";
    const html = renderMarkdown(md);
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>");
    expect(html).toContain("Item 1");
  });

  it("renders ordered lists", () => {
    const md = "1. First\n2. Second\n3. Third";
    const html = renderMarkdown(md);
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>");
  });

  // --- Blockquotes ---
  it("renders blockquotes", () => {
    const md = "> This is a quote";
    const html = renderMarkdown(md);
    expect(html).toContain("<blockquote>");
    expect(html).toContain("This is a quote");
  });

  // --- Tables ---
  it("renders tables", () => {
    const md = "| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |";
    const html = renderMarkdown(md);
    expect(html).toContain("<table>");
    expect(html).toContain("<th>");
    expect(html).toContain("<td>");
  });

  // --- Horizontal rules ---
  it("renders horizontal rules", () => {
    const html = renderMarkdown("---");
    expect(html).toContain("<hr");
  });

  // --- Paragraphs ---
  it("wraps text in paragraphs", () => {
    const html = renderMarkdown("Hello world");
    expect(html).toContain("<p>Hello world</p>");
  });

  it("separates paragraphs with double newlines", () => {
    const html = renderMarkdown("Paragraph 1\n\nParagraph 2");
    expect(html).toContain("<p>Paragraph 1</p>");
    expect(html).toContain("<p>Paragraph 2</p>");
  });

  // --- Edge cases ---
  it("returns empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
  });

  it("handles mixed content", () => {
    const md = `# Title

Some **bold** and *italic* text with [a link](https://example.com).

\`\`\`js
const x = 1;
\`\`\`

> A quote

- Item 1
- Item 2`;

    const html = renderMarkdown(md);
    expect(html).toContain("<h1");
    expect(html).toContain("<strong>");
    expect(html).toContain("<em>");
    expect(html).toContain("<a ");
    expect(html).toContain("<pre>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<ul>");
  });

  // --- XSS prevention ---
  it("escapes HTML in regular text", () => {
    const html = renderMarkdown("<script>alert('xss')</script>");
    expect(html).not.toContain("<script>");
  });

  it("escapes HTML in code blocks", () => {
    const md = "```\n<script>alert('xss')</script>\n```";
    const html = renderMarkdown(md);
    expect(html).not.toContain("<script>alert");
  });
});
