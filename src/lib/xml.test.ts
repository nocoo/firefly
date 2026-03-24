import { describe, it, expect } from "vitest";
import { escapeXml } from "./xml";

describe("escapeXml", () => {
  it("escapes ampersand", () => {
    expect(escapeXml("foo & bar")).toBe("foo &amp; bar");
  });

  it("escapes angle brackets", () => {
    expect(escapeXml("<tag>")).toBe("&lt;tag&gt;");
  });

  it("escapes quotes", () => {
    expect(escapeXml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes apostrophe", () => {
    expect(escapeXml("it's")).toBe("it&apos;s");
  });

  it("handles strings with no special characters", () => {
    expect(escapeXml("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(escapeXml("")).toBe("");
  });

  it("escapes all entities in one string", () => {
    expect(escapeXml(`<a href="x" title='y'>A & B</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&apos;y&apos;&gt;A &amp; B&lt;/a&gt;",
    );
  });
});
