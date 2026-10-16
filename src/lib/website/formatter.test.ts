import { load } from "cheerio/slim";
import { describe, expect, it } from "vitest";
import { absoluteWebsiteImageUrl, formatWebsiteHtml } from "./formatter";

const BASE_URL = "https://lizheng.blog/2026/10/example-post";

describe("website HTML formatter", () => {
  it("normalizes all headings and removes all attributes except inline link hrefs", () => {
    const headings = [1, 2, 3, 4, 5, 6].map((depth) =>
      `<h${depth} id="heading" class="title" style="color:red">Heading ${depth}</h${depth}>`,
    ).join("");
    const result = formatWebsiteHtml(`${headings}<p class="body" style="margin:0"><a href="https://example.com/?a=1&amp;b=2" target="_blank" onclick="alert(1)"><strong>Link</strong></a></p>`, BASE_URL);
    const $ = load(result.html, null, false);
    expect($("h2")).toHaveLength(6);
    expect($("h1,h3,h4,h5,h6,[class],[style],[id],[target],[onclick]")).toHaveLength(0);
    expect($("a").attr("href")).toBe("https://example.com/?a=1&b=2");
    expect($("a strong").text()).toBe("Link");
    expect(result.images).toEqual([]);
  });

  it.each([
    "java\tscript:alert(1)", "java\nscript:alert(1)", "java\rscript:alert(1)",
    "java&#x09;script:alert(1)", "java&#10;script:alert(1)", "java script:alert(1)",
    "&#1;javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,bad",
    "vbscript:msgbox(1)", "file:///etc/passwd", "ftp://example.com/file", "tel:+123",
    "https://[invalid", "", "   ",
  ])("removes unsafe or invalid decoded href %j while preserving inline content", (href) => {
    const result = formatWebsiteHtml(`<p><a href="${href}" class="bad"><strong>Link</strong></a></p>`, BASE_URL);
    expect(result.html).toBe("<p><strong>Link</strong></p>");
    expect(result.images).toEqual([]);
  });

  it("preserves the text of an anchor without href", () => {
    expect(formatWebsiteHtml("<p><a>Link</a></p>", BASE_URL).html).toBe("<p>Link</p>");
  });

  it.each(["https://example.com/path", "http://example.com/path", "mailto:writer@example.com"])("allows only supported link protocols: %s", (href) => {
    const result = formatWebsiteHtml(`<p><a href="${href}">Link</a></p>`, BASE_URL);
    expect(load(result.html, null, false)("a").attr("href")).toBe(href);
  });

  it("replaces standalone images and emits each occurrence with its source block position", () => {
    const result = formatWebsiteHtml('<h2>First</h2>\n<p><img src="/one.png?a=1&amp;b=2" alt="One &amp; two"></p>\n<p>Text</p>\n<p><img src="//cdn.example.com/two.png"><img src="/one.png?a=1&amp;b=2" alt="Again"></p>', BASE_URL);
    expect(result.html).toBe("<h2>First</h2>\n<p>[图片 1]</p>\n<p>Text</p>\n<p>[图片 2]</p>\n<p>[图片 3]</p>");
    expect(result.images).toEqual([
      { index: 1, url: "https://lizheng.blog/one.png?a=1&b=2", alt: "One & two", position: 1 },
      { index: 2, url: "https://cdn.example.com/two.png", alt: "", position: 3 },
      { index: 3, url: "https://lizheng.blog/one.png?a=1&b=2", alt: "Again", position: 3 },
    ]);
  });

  it("places inline and nested image paragraphs after their containing top-level block", () => {
    const result = formatWebsiteHtml('<p>Before <img src="./inline.png" alt="Inline"> after</p><blockquote><p>Quote <img src="../quote.png" alt="Quote"></p></blockquote><ul><li>List <img src="https://cdn.example.com/list.png" alt="List"></li><li><img src="/last.png" alt="Last"></li></ul><p>End</p>', BASE_URL);
    expect(result.html).toBe('<p>Before  after</p>\n<p>[图片 1]</p>\n<blockquote><p>Quote </p></blockquote>\n<p>[图片 2]</p>\n<ul><li>List </li></ul>\n<p>[图片 3]</p>\n<p>[图片 4]</p>\n<p>End</p>');
    expect(result.images).toEqual([
      { index: 1, url: "https://lizheng.blog/2026/10/inline.png", alt: "Inline", position: 0 },
      { index: 2, url: "https://lizheng.blog/2026/quote.png", alt: "Quote", position: 1 },
      { index: 3, url: "https://cdn.example.com/list.png", alt: "List", position: 2 },
      { index: 4, url: "https://lizheng.blog/last.png", alt: "Last", position: 2 },
    ]);
    expect(load(result.html, null, false)("img")).toHaveLength(0);
  });

  it("unwraps non-semantic elements, preserves text, and removes form controls", () => {
    const result = formatWebsiteHtml('<div class="wrapper"><span>Text</span><p><del>Old</del><br><input type="checkbox">New</p><p><img src="/image.png"><hr></p></div>', BASE_URL);
    const $ = load(result.html, null, false);
    expect($("div,span,del,br,input,[class],[style]")).toHaveLength(0);
    expect($.root().children().first().prop("tagName")).toBe("P");
    expect($.text()).toContain("Old\nNew");
    expect($("hr")).toHaveLength(1);
    expect(result.images).toEqual([{ index: 1, url: "https://lizheng.blog/image.png", alt: "", position: 2 }]);
  });

  it("wraps root-level inline elements and images without retaining wrapper divs", () => {
    const result = formatWebsiteHtml('<a href="/source">Source</a><img src="/image.png">', BASE_URL);
    expect(result.html).toBe('<p><a href="/source">Source</a></p>\n<p>[图片 1]</p>');
    expect(result.images[0]?.position).toBe(1);
  });

  it("extracts linked images without leaving empty links or losing surrounding text", () => {
    const result = formatWebsiteHtml('<p><a href="/full"><strong><img src="/thumb.png" alt="Thumbnail"></strong></a></p><p>Read <a href="/article">article</a> <a href="/full"><img src="/thumb.png"></a></p>', BASE_URL);
    expect(result.html).toBe('<p>[图片 1]</p>\n<p>Read <a href="/article">article</a> </p>\n<p>[图片 2]</p>');
    expect(result.images.map(({ index, position }) => ({ index, position }))).toEqual([
      { index: 1, position: 0 }, { index: 2, position: 1 },
    ]);
  });

  it.each(["", " \n\t"])("handles empty or whitespace-only HTML %j", (html) => {
    expect(formatWebsiteHtml(html, BASE_URL)).toEqual({ html: "", images: [] });
  });
});

describe("absolute website image URLs", () => {
  it.each([
    ["/cover.png", "https://lizheng.blog/cover.png"],
    ["./cover.png", "https://lizheng.blog/2026/10/cover.png"],
    ["https://assets.example.com/cover.png", "https://assets.example.com/cover.png"],
  ])("resolves %s", (source, expected) => {
    expect(absoluteWebsiteImageUrl(source, BASE_URL)).toBe(expected);
  });

  it.each(["data:image/png;base64,AA", "mailto:image@example.com", "https://user:pass@example.com/image.png"])("rejects unsafe image URL %s", (source) => {
    expect(() => absoluteWebsiteImageUrl(source, BASE_URL)).toThrow("HTTP(S)");
  });

  it.each(["", "   "])("rejects a missing image URL %j rather than using the article URL", (source) => {
    expect(() => absoluteWebsiteImageUrl(source, BASE_URL)).toThrow("Website image URL is missing");
  });
});
