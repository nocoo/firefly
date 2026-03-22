import { describe, it, expect } from "vitest";
import { slugify, readingTime, excerptFromContent } from "./post";

// ---------------------------------------------------------------------------
// slugify()
// ---------------------------------------------------------------------------

describe("slugify", () => {
  it("converts basic English text to lowercase slug", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces multiple spaces with single dash", () => {
    expect(slugify("Hello   World")).toBe("hello-world");
  });

  it("removes special characters", () => {
    expect(slugify("Hello, World! How's it?")).toBe("hello-world-hows-it");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("  Hello World  ")).toBe("hello-world");
  });

  it("collapses consecutive dashes", () => {
    expect(slugify("Hello---World")).toBe("hello-world");
  });

  it("handles Chinese characters (passthrough)", () => {
    expect(slugify("我的博客文章")).toBe("我的博客文章");
  });

  it("handles mixed Chinese and English", () => {
    expect(slugify("Hello 世界 Test")).toBe("hello-世界-test");
  });

  it("handles numbers", () => {
    expect(slugify("Top 10 Tips for 2026")).toBe("top-10-tips-for-2026");
  });

  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });

  it("handles already-slugified input", () => {
    expect(slugify("hello-world")).toBe("hello-world");
  });

  it("strips HTML-like characters", () => {
    expect(slugify("Hello <World> & Friends")).toBe("hello-world-friends");
  });
});

// ---------------------------------------------------------------------------
// readingTime()
// ---------------------------------------------------------------------------

describe("readingTime", () => {
  it("returns 1 for short text", () => {
    expect(readingTime("Hello world")).toBe(1);
  });

  it("estimates based on ~200 words per minute", () => {
    const words = Array(400).fill("word").join(" ");
    expect(readingTime(words)).toBe(2);
  });

  it("rounds up to next minute", () => {
    const words = Array(250).fill("word").join(" ");
    expect(readingTime(words)).toBe(2); // 250/200 = 1.25 → 2
  });

  it("returns 1 for empty content", () => {
    expect(readingTime("")).toBe(1);
  });

  it("counts CJK characters (1 char ≈ 1 word at ~300 chars/min)", () => {
    // 600 Chinese characters → about 2 minutes at 300 chars/min
    const text = "中".repeat(600);
    expect(readingTime(text)).toBe(2);
  });

  it("handles mixed content with markdown", () => {
    const md = `# Title\n\nSome text with **bold** and [link](url).\n\n${Array(200).fill("word").join(" ")}`;
    // Should strip markdown formatting before counting
    expect(readingTime(md)).toBeGreaterThanOrEqual(1);
  });

  it("handles code blocks", () => {
    const md = "```\nconst x = 1;\nconst y = 2;\n```\n" + Array(200).fill("word").join(" ");
    expect(readingTime(md)).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// excerptFromContent()
// ---------------------------------------------------------------------------

describe("excerptFromContent", () => {
  it("extracts first N characters from plain text", () => {
    const text = "This is a long blog post about TypeScript and its benefits for web development.";
    const result = excerptFromContent(text, 30);
    expect(result.length).toBeLessThanOrEqual(30);
    // Truncates at word boundary before maxLength
    expect(result).toBe("This is a long blog post");
  });

  it("strips markdown formatting", () => {
    const md = "**Bold** and *italic* with [link](url) content here.";
    const result = excerptFromContent(md);
    expect(result).not.toContain("**");
    expect(result).not.toContain("*");
    expect(result).not.toContain("[");
    expect(result).not.toContain("](");
  });

  it("strips HTML tags", () => {
    const html = "<p>Hello <strong>world</strong></p>";
    const result = excerptFromContent(html);
    expect(result).not.toContain("<");
    expect(result).toContain("Hello");
    expect(result).toContain("world");
  });

  it("collapses whitespace", () => {
    const text = "Hello   world\n\nnew paragraph";
    const result = excerptFromContent(text);
    expect(result).not.toContain("\n");
    expect(result).toContain("Hello world");
  });

  it("defaults to 160 chars max", () => {
    const longText = Array(50).fill("word").join(" "); // well over 160 chars
    const result = excerptFromContent(longText);
    expect(result.length).toBeLessThanOrEqual(160);
  });

  it("truncates at word boundary", () => {
    const text = "The quick brown fox jumps over the lazy dog everyday";
    const result = excerptFromContent(text, 20);
    // Should not cut in the middle of a word
    expect(result).toBe("The quick brown fox");
  });

  it("returns full text if under limit", () => {
    const text = "Short text";
    expect(excerptFromContent(text)).toBe("Short text");
  });

  it("returns empty string for empty input", () => {
    expect(excerptFromContent("")).toBe("");
  });

  it("strips heading markers", () => {
    const md = "# Heading\n\nParagraph text here.";
    const result = excerptFromContent(md);
    expect(result).not.toMatch(/^#/);
    expect(result).toContain("Paragraph text here");
  });

  it("strips code blocks", () => {
    const md = "```js\nconst x = 1;\n```\n\nText after code.";
    const result = excerptFromContent(md);
    expect(result).not.toContain("const x");
    expect(result).toContain("Text after code");
  });
});
