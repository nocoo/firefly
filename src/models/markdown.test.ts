import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderMarkdown } from "./markdown";

const originalR2PublicUrl = process.env.R2_PUBLIC_URL;

beforeEach(() => {
  process.env.R2_PUBLIC_URL = originalR2PublicUrl;
  vi.restoreAllMocks();
});

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

  it("renders images without alt text with empty alt attribute", () => {
    const html = renderMarkdown("![](https://example.com/img.jpg)");
    expect(html).toContain('alt="img"');
  });

  it("renders image title attribute", () => {
    const html = renderMarkdown('![Alt](https://example.com/img.jpg "My title")');
    expect(html).toContain('alt="Alt"');
    expect(html).toContain('title="My title"');
  });

  it("uses title as alt fallback when alt text is empty", () => {
    const html = renderMarkdown('![](https://example.com/img.jpg "Fallback title")');
    expect(html).toContain('alt="Fallback title"');
    expect(html).toContain('title="Fallback title"');
  });

  it("uses postTitle + filename as alt fallback when no alt or title", () => {
    const html = renderMarkdown("![](https://example.com/photo.jpg)", { postTitle: "My Post" });
    expect(html).toContain('alt="My Post - photo"');
  });

  it("uses filename only as alt fallback when no postTitle", () => {
    const html = renderMarkdown("![](https://example.com/5D3L2883.jpg)");
    expect(html).toContain('alt="5D3L2883"');
  });

  it("uses postTitle when the image URL has no filename", () => {
    const html = renderMarkdown("![](https://example.com/)", { postTitle: "My Post" });
    expect(html).toContain('alt="My Post"');
  });

  it("uses an empty alt attribute when neither postTitle nor filename is available", () => {
    const html = renderMarkdown("![](https://example.com/)");
    expect(html).toContain('alt=""');
  });

  it("falls back safely when filename extraction returns undefined", () => {
    const originalPop = Array.prototype.pop as (this: unknown[]) => unknown;
    vi.spyOn(Array.prototype, "pop").mockImplementation(function (this: unknown[]) {
      if (
        this.length === 3 &&
        this[0] === "" &&
        this[1] === "uploads" &&
        this[2] === "photo.jpg"
      ) {
        return undefined;
      }

      return originalPop.call(this);
    });

    const html = renderMarkdown("![](https://example.com/uploads/photo.jpg)", {
      postTitle: "My Post",
    });
    expect(html).toContain('alt="My Post"');
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

  it("returns empty string when marked returns a non-string result", async () => {
    // `parse` is an own instance property (bound in the Marked constructor),
    // so prototype-level mocks can't intercept it. We must reset the module
    // graph, mock `marked` to make `parse` return a non-string, and then
    // re-import `renderMarkdown` so it picks up the mocked Marked.
    vi.resetModules();
    vi.doMock("marked", () => ({
      Marked: class {
        parse() {
          return undefined;
        }
      },
    }));
    const { renderMarkdown: freshRender } = await import("./markdown");
    expect(freshRender("Hello world", { postTitle: "Synthetic" })).toBe("");
    vi.doUnmock("marked");
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

  it("allows bare relative paths in links", () => {
    const html = renderMarkdown("[Guide](docs/getting-started.html)");
    expect(html).toContain('href="docs/getting-started.html"');
    expect(html).not.toContain('target="_blank"');
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

// ---------------------------------------------------------------------------
// renderMarkdown — optimizeImages option
// ---------------------------------------------------------------------------

describe("renderMarkdown with optimizeImages", () => {
  const opts = { optimizeImages: true };
  // R2_PUBLIC_URL is set to https://assets.example.com in vitest.config.ts
  const assetsHostname = (() => {
    const url = process.env.R2_PUBLIC_URL;
    if (!url) return "assets.example.com";
    try {
      return new URL(url).hostname;
    } catch {
      return "assets.example.com";
    }
  })();
  const internalUrl = `https://${assetsHostname}/uploads/photo.jpg`;
  const externalUrl = "https://external-site.org/img.jpg";

  it("default mode: image renders raw <img> without srcset", () => {
    const html = renderMarkdown(`![Alt](${internalUrl})`);
    expect(html).toContain(`src="${internalUrl}"`);
    expect(html).not.toContain("srcset");
    expect(html).not.toContain("/_next/image");
  });

  it("optimized mode: internal image gets /_next/image src", () => {
    const html = renderMarkdown(`![Alt](${internalUrl})`, opts);
    expect(html).toContain('src="/_next/image?url=');
    expect(html).toContain(encodeURIComponent(internalUrl));
    expect(html).toContain("&amp;w=1080&amp;q=75");
  });

  it("optimized mode: internal image gets srcset with multiple widths", () => {
    const html = renderMarkdown(`![Alt](${internalUrl})`, opts);
    expect(html).toContain("srcset=");
    expect(html).toContain("640w");
    expect(html).toContain("828w");
    expect(html).toContain("1080w");
    expect(html).toContain("1920w");
  });

  it("optimized mode: internal image gets sizes attribute", () => {
    const html = renderMarkdown(`![Alt](${internalUrl})`, opts);
    expect(html).toContain('sizes="(max-width: 900px) 100vw, min(75vw, 1000px)"');
  });

  it("optimized mode: data-original-src preserves original URL", () => {
    const html = renderMarkdown(`![Alt](${internalUrl})`, opts);
    expect(html).toContain(`data-original-src="${internalUrl}"`);
  });

  it("optimized mode: decoding=async is added", () => {
    const html = renderMarkdown(`![Alt](${internalUrl})`, opts);
    expect(html).toContain('decoding="async"');
  });

  it("optimized mode: external image URL is unchanged", () => {
    const html = renderMarkdown(`![Alt](${externalUrl})`, opts);
    expect(html).toContain(`src="${externalUrl}"`);
    expect(html).not.toContain("/_next/image");
    expect(html).not.toContain("srcset");
    expect(html).toContain('loading="lazy"');
  });

  it("optimized mode: relative image URL is unchanged", () => {
    const html = renderMarkdown("![Alt](/path/to/img.jpg)", opts);
    expect(html).toContain('src="/path/to/img.jpg"');
    expect(html).not.toContain("/_next/image");
    expect(html).not.toContain("srcset");
  });

  it("optimized mode: XSS in image src still blocked", () => {
    const html = renderMarkdown("![alt](javascript:alert(1))", opts);
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("src=");
  });

  it("optimized mode: only images are affected, other elements unchanged", () => {
    const md = `# Heading\n\n[Link](https://example.com)\n\n![Img](${internalUrl})\n\n\`\`\`js\ncode\n\`\`\``;
    const html = renderMarkdown(md, opts);
    // Heading unchanged
    expect(html).toContain('<h1 id="heading">Heading</h1>');
    // Link unchanged
    expect(html).toContain('href="https://example.com"');
    // Image optimized
    expect(html).toContain("/_next/image");
    expect(html).toContain("srcset");
    // Code unchanged
    expect(html).toContain("<pre><code");
  });

  it("optimized mode: only R2 assets domain is optimized, other domains are not", () => {
    const otherUrl = "https://other-site.com/some/image.png";
    const html = renderMarkdown(`![Alt](${otherUrl})`, opts);
    // Should NOT be optimized — not in whitelist
    expect(html).not.toContain("/_next/image");
    expect(html).not.toContain("srcset");
    expect(html).toContain(`src="${otherUrl}"`);
  });

  it("optimized mode: does not proxy images when R2_PUBLIC_URL is missing at module load", async () => {
    delete process.env.R2_PUBLIC_URL;
    vi.resetModules();

    try {
      const { renderMarkdown: renderWithoutR2Url } = await import("./markdown");
      const html = renderWithoutR2Url(`![Alt](${internalUrl})`, opts);
      expect(html).toContain(`src="${internalUrl}"`);
      expect(html).not.toContain("/_next/image");
      expect(html).not.toContain("srcset");
    } finally {
      process.env.R2_PUBLIC_URL = originalR2PublicUrl;
      vi.resetModules();
    }
  });
});
