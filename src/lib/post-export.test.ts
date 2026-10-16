import { describe, expect, it } from "vitest";
import { load } from "cheerio/slim";
import { renderMarkdown } from "../models/markdown";
import { inlineWeChatHtml } from "./wechat/formatter";
import { POST_EXPORT_FORMATS, renderPostExport, type ExportablePost } from "./post-export";

describe("post export", () => {
  it("matches the admin clipboard HTML byte for byte without a browser DOM", () => {
    const post: ExportablePost = {
      content: '## Heading\n\n**Bold** and [external](https://example.com/?a=1&b=2).\n\n![Image](https://example.com/body.png)\n\n| A | B |\n| --- | --- |\n| one | two |\n\n```ts\nconst x = 1;\n```\n\nA note[^1].\n\n[^1]: Footnote',
      title: "Title <&>",
      excerpt: "Summary <&>",
      featured_image: "https://example.com/cover.png?a=1&b=2",
      reference_url: "https://example.com/source",
      reference_title: "Reference <&>",
      reference_description: "Description <&>",
      reference_image: "https://example.com/reference.png",
    };
    expect(typeof document).toBe("undefined");
    const actual = renderPostExport(post, "wechat").html;
    expect(actual).toBe(inlineWeChatHtml(renderMarkdown(post.content), {
      title: post.title,
      excerpt: post.excerpt!,
      featuredImage: post.featured_image!,
      referenceUrl: post.reference_url!,
      referenceTitle: post.reference_title!,
      referenceDescription: post.reference_description!,
      referenceImage: post.reference_image!,
    }));
    expect(actual).toContain("font-size: 20px");
    expect(actual).toContain("wechat-footnotes");
    expect(actual).toContain("wechat-reference-card");
    expect(actual).not.toContain("wechat-post-title");
    expect(actual).not.toContain("wechat-post-excerpt");
    expect(actual).not.toContain("/_next/image");
  });

  it("registers both formats and handles empty WeChat content and nullable metadata", () => {
    expect(POST_EXPORT_FORMATS).toEqual(["wechat", "website"]);
    expect(renderPostExport({
      title: "", content: "", excerpt: null, featured_image: null,
      reference_url: null, reference_title: null,
      reference_description: null, reference_image: null,
    }, "wechat")).toEqual({ html: inlineWeChatHtml("") });
  });

  const websitePost: ExportablePost = {
    title: "Example post",
    content: "",
    excerpt: "Not part of the article body",
    featured_image: "/cover.png",
    reference_url: "https://example.com/reference",
    reference_title: "Reference card is not part of the body",
    reference_description: null,
    reference_image: "/reference.png",
  };

  it("renders clean semantic Markdown with inline links, lists, quotes, and code", () => {
    const result = renderPostExport({ ...websitePost, content: '# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six\n\n**Bold** and *emphasis*, `inline`, [external](https://example.com/?a=1&b=2) and [local](/source).\n\n- First\n- Second\n\n1. Ordered\n2. List\n\n> Quote\n\n```ts\nconst html = "<div style=\\"color:red\\">";\n```\n\n---' }, "website");
    const $ = load(result.html, null, false);
    expect($("h2").map((_, heading) => $(heading).text()).get()).toEqual(["One", "Two", "Three", "Four", "Five", "Six"]);
    expect($("a").map((_, link) => $(link).attr("href")).get()).toEqual(["https://example.com/?a=1&b=2", "https://lizheng.blog/source"]);
    expect($("strong").text()).toBe("Bold");
    expect($("em").text()).toBe("emphasis");
    expect($("ul li")).toHaveLength(2);
    expect($("ol li")).toHaveLength(2);
    expect($("blockquote p").text()).toBe("Quote");
    expect($("pre code").text()).toBe('const html = "<div style=\\"color:red\\">";');
    expect($("hr")).toHaveLength(1);
    expect($("h1,h3,h4,h5,h6,div,section,sup,img,[class],[style]")).toHaveLength(0);
    expect(result.html).not.toContain("Not part of the article body");
    expect(result.html).not.toContain("Reference card");
    expect(result.images).toEqual([]);
    expect(typeof document).toBe("undefined");
  });

  it("extracts Markdown images without cover/reference cards or image optimization", () => {
    const result = renderPostExport({ ...websitePost, content: "# First\n\n![Diagram](./diagram.png)\n\nParagraph with ![inline](/inline.png).\n\n![Again](./diagram.png)" }, "website", "https://lizheng.blog/2026/10/example-post");
    expect(result.html).toBe("<h2>First</h2>\n<p>[图片 1]</p>\n<p>Paragraph with .</p>\n<p>[图片 2]</p>\n<p>[图片 3]</p>");
    expect(result.images).toEqual([
      { index: 1, url: "https://lizheng.blog/2026/10/diagram.png", alt: "Diagram", position: 1 },
      { index: 2, url: "https://lizheng.blog/inline.png", alt: "inline", position: 2 },
      { index: 3, url: "https://lizheng.blog/2026/10/diagram.png", alt: "Again", position: 3 },
    ]);
    expect(result.html).not.toContain("/_next/image");
    expect(result.html).not.toContain("cover.png");
    expect(result.html).not.toContain("reference.png");
  });

  it("preserves Markdown hard breaks and list numbering while resolving links against the article URL", () => {
    const url = "https://lizheng.blog/2026/10/example-post";
    const content = "[Root](/source) [Parent](../source) [Section](#part)\n\nFirst  \nSecond\\\nThird\n\n7. Seven\n8. Eight\n\nA note[^4].\n\n[^4]: Footnote";
    const result = renderPostExport({ ...websitePost, content }, "website", url);
    const $ = load(result.html, null, false);
    expect($("a").map((_, link) => $(link).attr("href")).get()).toEqual([
      "https://lizheng.blog/source", "https://lizheng.blog/2026/source", `${url}#part`, `${url}#fn-4`,
    ]);
    expect($("br")).toHaveLength(2);
    expect($("ol").first().attr("start")).toBe("7");
    expect($("li[value='4']").text()).toBe("Footnote");
    expect($("[class],[style]")).toHaveLength(0);
  });

  it.each(["java\tscript:alert(1)", "java script:alert(1)"])("blocks obfuscated Markdown links in the complete website export: %j", (href) => {
    const result = renderPostExport({ ...websitePost, content: `[**Unsafe**](<${href}>)` }, "website");
    expect(result.html).toBe("<p><strong>Unsafe</strong></p>");
  });

  it("keeps the website protocol policy narrower than the shared Markdown sanitizer", () => {
    const content = "[**Call**](tel:+1234567890) [Email](mailto:writer@example.com)";
    expect(renderMarkdown(content)).toContain('href="tel:+1234567890"');
    const result = renderPostExport({ ...websitePost, content }, "website");
    expect(result.html).toBe('<p><strong>Call</strong> <a href="mailto:writer@example.com">Email</a></p>');
  });

  it("uses the existing Markdown sanitizer rather than accepting raw executable HTML", () => {
    const result = renderPostExport({ ...websitePost, content: '<div class="bad" style="color:red"><script>alert(1)</script></div>\n\n[bad](javascript:alert(1))\n\n![bad](javascript:alert(1))' }, "website");
    const $ = load(result.html, null, false);
    expect($("div,script,img,[class],[style]")).toHaveLength(0);
    expect($("a")).toHaveLength(0);
    expect($.text()).toContain('<script>alert(1)</script>');
    expect(result.images).toEqual([]);
  });

  it("returns empty website content with no images", () => {
    expect(renderPostExport(websitePost, "website")).toEqual({ html: "", images: [] });
  });
});
