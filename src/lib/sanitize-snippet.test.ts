import { describe, it, expect } from "vitest";
import { sanitizeSnippet } from "./sanitize-snippet";

describe("sanitizeSnippet", () => {
  it("preserves <mark> tags", () => {
    expect(sanitizeSnippet("Hello <mark>World</mark>")).toBe(
      "Hello <mark>World</mark>",
    );
  });

  it("strips non-mark HTML tags", () => {
    expect(sanitizeSnippet('<script>alert("xss")</script>Hello')).toBe(
      'alert("xss")Hello',
    );
    expect(sanitizeSnippet("<b>bold</b> <mark>hi</mark>")).toBe(
      "bold <mark>hi</mark>",
    );
    expect(sanitizeSnippet('<a href="x">link</a>')).toBe("link");
  });

  it("collapses spaces between CJK characters", () => {
    expect(sanitizeSnippet("边缘 计算 应用")).toBe("边缘计算应用");
  });

  it("preserves spaces around Latin words", () => {
    expect(sanitizeSnippet("使用 cloudflare 构建")).toBe(
      "使用 cloudflare 构建",
    );
  });

  it("handles mark tags between CJK characters", () => {
    expect(
      sanitizeSnippet("使用 cloudflare 构建 <mark>边缘</mark> <mark>计算</mark> 应用"),
    ).toBe("使用 cloudflare 构建<mark>边缘</mark><mark>计算</mark>应用");
  });

  it("handles mixed CJK and Latin with marks", () => {
    expect(
      sanitizeSnippet("这是 <mark>React</mark> 框架"),
    ).toBe("这是 <mark>React</mark> 框架");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeSnippet("")).toBe("");
  });

  it("handles multiple consecutive CJK spaces with marks in between", () => {
    expect(
      sanitizeSnippet("中文 <mark>全文</mark> <mark>搜索</mark> 测试"),
    ).toBe("中文<mark>全文</mark><mark>搜索</mark>测试");
  });
});
