import { describe, it, expect, vi } from "vitest";
import juice from "juice";
import {
  convertLinksToFootnotes,
  buildWeChatStructure,
  inlineWeChatHtml,
} from "./formatter";
import { extractPlainText, stripImagesFromHtml } from "./clipboard";

describe("WeChat Formatter", () => {
  describe("convertLinksToFootnotes", () => {
    it("converts external links to footnotes", () => {
      const input = '<p>Check <a href="https://example.com">Example</a> now.</p>';
      const result = convertLinksToFootnotes(input);
      expect(result).toContain("<span>Example</span><sup class=\"wechat-footnote-ref\">[1]</sup>");
      expect(result).toContain('<section class="wechat-footnotes">');
      expect(result).toContain("<h4>参考链接</h4>");
      expect(result).toContain("Example: </span><span style=\"word-break: break-all;\">https://example.com");
    });

    it("correctly decodes HTML entities in link href without double escaping", () => {
      // Marked produces href with &amp;
      const input = '<p>Search <a href="https://example.com/search?a=1&amp;b=2">A &amp; B</a></p>';
      const result = convertLinksToFootnotes(input);
      expect(result).toContain("https://example.com/search?a=1&amp;b=2");
      expect(result).not.toContain("&amp;amp;");
      expect(result).toContain("A &amp; B: ");
    });

    it("skips internal and anchor links", () => {
      const input = '<p><a href="#heading">Jump</a> and <a href="/blog/hello">Internal</a> and <a href="./rel">Rel</a> and <a href="../parent">Parent</a>.</p>';
      const result = convertLinksToFootnotes(input);
      expect(result).not.toContain("wechat-footnote-ref");
      expect(result).not.toContain("wechat-footnotes");
    });

    it("skips mp.weixin.qq.com links as WeChat supports them natively", () => {
      const input = '<p><a href="https://mp.weixin.qq.com/s/123">Article</a></p>';
      const result = convertLinksToFootnotes(input);
      expect(result).not.toContain("wechat-footnote-ref");
      expect(result).not.toContain("wechat-footnotes");
    });

    it("handles invalid or empty URLs gracefully", () => {
      const input = '<p><a href="">Empty</a> and <a>No href</a></p>';
      const result = convertLinksToFootnotes(input);
      expect(result).not.toContain("wechat-footnote-ref");
    });

    it("deduplicates multiple identical URLs with the same reference number", () => {
      const input = '<p><a href="https://example.com">First</a> and <a href="https://example.com">Second</a></p>';
      const result = convertLinksToFootnotes(input);
      expect(result).toContain("<span>First</span><sup class=\"wechat-footnote-ref\">[1]</sup>");
      expect(result).toContain("<span>Second</span><sup class=\"wechat-footnote-ref\">[1]</sup>");
      // The body replaced the <a> tags with <span> so only 1 remains in the footnotes list
      const matches = result.match(/https:\/\/example\.com/g) || [];
      expect(matches.length).toBe(1);
    });
  });

  describe("buildWeChatStructure", () => {
    it("handles empty meta and empty content", () => {
      const result = buildWeChatStructure("");
      expect(result).toBe("");
    });

    it("excludes title and excerpt by default for WeChat (only includes cover, content, reference)", () => {
      const content = "<p>Main post content</p>";
      const meta = {
        title: "Test Title",
        excerpt: "Brief summary of the article",
        featuredImage: "https://example.com/cover.jpg",
        referenceUrl: "https://example.com/source",
        referenceTitle: "Source Website",
        referenceImage: "https://example.com/ref.jpg",
        referenceDescription: "Ref description",
      };

      const result = buildWeChatStructure(content, meta);
      expect(result).toContain('<div class="wechat-featured-image">');
      expect(result).not.toContain("wechat-post-title");
      expect(result).not.toContain("wechat-post-excerpt");
      expect(result).toContain('<div class="wechat-reference-card">');
      expect(result).toContain('<div class="wechat-reference-img">');
      expect(result).toContain("https://example.com/ref.jpg");
      expect(result).toContain("Source Website");
      expect(result).toContain("Ref description");
      expect(result).toContain("<p>Main post content</p>");
    });

    it("includes title and excerpt when includeHeaderMeta is true", () => {
      const content = "<p>Main post content</p>";
      const meta = {
        title: "Test Title",
        excerpt: "Brief summary of the article",
        featuredImage: "https://example.com/cover.jpg",
      };
      const result = buildWeChatStructure(content, meta, { includeHeaderMeta: true });
      expect(result).toContain('<h1 class="wechat-post-title">Test Title</h1>');
      expect(result).toContain('<div class="wechat-post-excerpt">Brief summary of the article</div>');
      expect(result).toContain("wechat-featured-image");
    });

    it("handles reference card without optional description or image", () => {
      const content = "<p>Main post content</p>";
      const meta = {
        referenceUrl: "https://example.com/source",
      };
      const result = buildWeChatStructure(content, meta);
      expect(result).toContain('<div class="wechat-reference-card">');
      expect(result).toContain('<div class="wechat-reference-title">https://example.com/source</div>');
      expect(result).not.toContain("wechat-reference-img");
      expect(result).not.toContain("wechat-reference-desc");
    });

    it("safely escapes HTML tags in metadata to prevent XSS", () => {
      const content = "<p>Clean content</p>";
      const maliciousMeta = {
        title: '<img src=x onerror="alert(1)">',
        excerpt: '<script>alert("xss")</script>',
        referenceTitle: 'Title with <b>bold</b> and <script>',
        referenceDescription: 'Desc with <iframe src="">',
      };

      const result = buildWeChatStructure(content, maliciousMeta, { includeHeaderMeta: true });
      expect(result).not.toContain('<img src=x');
      expect(result).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(result).not.toContain('<iframe');
    });
  });

  describe("inlineWeChatHtml", () => {
    it("inlines styles directly on HTML elements using juice", () => {
      const rawHtml = "<h2>Section Title</h2><p>Paragraph with <strong>bold</strong> text.</p>";
      const inlined = inlineWeChatHtml(rawHtml, { title: "My Article" }, { includeHeaderMeta: true });

      expect(inlined).toContain('style="');
      // Should have applied styles inline to headers and paragraphs
      expect(inlined).toContain("font-size: 20px"); // h2 style
      expect(inlined).toContain("color: #141413");
      expect(inlined).toContain("My Article");
    });

    it("handles errors from juice gracefully", () => {
      const spy = vi.spyOn(juice, "inlineContent").mockImplementation(() => {
        throw new Error("juice parsing error");
      });
      const rawHtml = "<p>Test fallback</p>";
      const inlined = inlineWeChatHtml(rawHtml);
      expect(inlined).toContain('<section id="bm-md"><p>Test fallback</p></section>');
      spy.mockRestore();
    });
  });

  describe("extractPlainText", () => {
    it("preserves paragraph and list item boundaries without sticking together", () => {
      const html = "<h1>Title</h1><p>First paragraph.</p><p>Second.</p><ul><li>One</li><li>Two</li></ul>";
      const plain = extractPlainText(html);
      expect(plain).toContain("Title\n\nFirst paragraph.\n\nSecond.");
      expect(plain).toContain("One");
      expect(plain).toContain("Two");
      expect(plain).not.toContain("TitleFirst");
    });
  });

  describe("stripImagesFromHtml", () => {
    it("removes img, picture, and figure elements from HTML", () => {
      const html = "<p>Intro</p><figure><img src='pic.jpg' /><figcaption>Cap</figcaption></figure><p>Text <img src='icon.png'/> more</p>";
      const stripped = stripImagesFromHtml(html);
      expect(stripped).not.toContain("pic.jpg");
      expect(stripped).not.toContain("icon.png");
      expect(stripped).not.toContain("<figure");
      expect(stripped).toContain("<p>Intro</p>");
      expect(stripped).toContain("<p>Text  more</p>");
    });
  });
});
