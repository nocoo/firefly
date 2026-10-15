import { describe, expect, it } from "vitest";
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
    const actual = renderPostExport(post, "wechat");
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

  it("handles empty content and nullable metadata using only the wechat formatter", () => {
    expect(POST_EXPORT_FORMATS).toEqual(["wechat"]);
    expect(renderPostExport({
      title: "", content: "", excerpt: null, featured_image: null,
      reference_url: null, reference_title: null,
      reference_description: null, reference_image: null,
    }, "wechat")).toBe(inlineWeChatHtml(""));
  });
});
