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

  // --- XSS: link href injection ---
  it("blocks javascript: URLs in links", () => {
    const html = renderMarkdown("[click](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("href=");
    expect(html).toContain("click"); // text should still render
  });

  it("blocks data: URLs in links", () => {
    const html = renderMarkdown("[click](data:text/html,<script>alert(1)</script>)");
    expect(html).not.toContain("data:");
    expect(html).not.toContain("href=");
  });

  it("blocks vbscript: URLs in links", () => {
    const html = renderMarkdown("[click](vbscript:msgbox)");
    expect(html).not.toContain("vbscript:");
    expect(html).not.toContain("href=");
  });

  it("allows mailto: and tel: URLs in links", () => {
    const html1 = renderMarkdown("[email](mailto:user@example.com)");
    expect(html1).toContain('href="mailto:user@example.com"');

    const html2 = renderMarkdown("[call](tel:+1234567890)");
    expect(html2).toContain('href="tel:+1234567890"');
  });

  it("escapes quotes in link href attributes", () => {
    const html = renderMarkdown('[click](https://example.com/a"onmouseover="alert(1))');
    expect(html).not.toContain('"onmouseover=');
    expect(html).toContain("&quot;");
  });

  // --- XSS: image src injection ---
  it("blocks javascript: URLs in images", () => {
    const html = renderMarkdown("![alt](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("src=");
  });

  it("escapes quotes in image alt text", () => {
    const html = renderMarkdown('!["><script>alert(1)</script>](https://example.com/img.jpg)');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&quot;");
  });

  // --- XSS: inline HTML in heading text ---
  it("escapes img onerror in heading text", () => {
    const html = renderMarkdown("# <img src=x onerror=alert(1)>");
    // The raw <img> tag must be escaped, not rendered as HTML element
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("escapes script tags in heading text", () => {
    const html = renderMarkdown("# <script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  // --- XSS: inline HTML in link text ---
  it("escapes img onerror in link text", () => {
    const html = renderMarkdown("[<img src=x onerror=alert(1)>](https://example.com)");
    // The raw <img> tag must be escaped, not rendered as HTML element
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("escapes script tags in link text", () => {
    const html = renderMarkdown("[<script>alert(1)</script>](https://example.com)");
    expect(html).not.toContain("<script>");
  });

  // --- Inline formatting still works inside heading/link ---
  it("preserves bold inside headings", () => {
    const html = renderMarkdown("# Hello **world**");
    expect(html).toContain("<strong>world</strong>");
    expect(html).toContain("<h1");
  });

  it("preserves bold inside link text", () => {
    const html = renderMarkdown("[Hello **world**](https://example.com)");
    expect(html).toContain("<strong>world</strong>");
    expect(html).toContain("<a ");
  });
});
