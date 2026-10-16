import { load } from "cheerio/slim";
import { sanitizeUrl } from "../../models/markdown";

export interface WebsiteImage {
  index: number;
  url: string;
  alt: string;
  position: number;
}

const SEMANTIC_TAGS = new Set([
  "h2", "p", "ul", "ol", "li", "blockquote", "pre", "code",
  "a", "strong", "em", "hr", "br", "img",
]);
const BLOCK_TAGS = new Set(["h2", "p", "ul", "ol", "blockquote", "pre", "hr"]);

export function absoluteWebsiteImageUrl(src: string, baseUrl: string): string {
  if (!src.trim()) throw new Error("Website image URL is missing");
  const url = new URL(src, baseUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Website images must use HTTP(S) URLs without credentials");
  }
  return url.href;
}

export function formatWebsiteHtml(contentHtml: string, baseUrl: string): {
  html: string;
  images: WebsiteImage[];
} {
  const $ = load(contentHtml, null, false);
  $("h1, h2, h3, h4, h5, h6").each((_, element) => {
    element.name = "h2";
  });
  for (const element of $.root().find("*").toArray()) {
    const node = $(element);
    if (element.name === "input") {
      node.remove();
    } else if (!SEMANTIC_TAGS.has(element.name)) {
      node.replaceWith(node.contents());
    } else if (element.name !== "img") {
      if (element.name === "a") {
        const href = sanitizeUrl(node.attr("href") ?? "");
        const url = href === null ? null : new URL(href, baseUrl);
        if (url === null || !["http:", "https:", "mailto:"].includes(url.protocol)) {
          node.replaceWith(node.contents());
          continue;
        }
        node.attr("href", url.href);
      }
      for (const attribute of Object.keys(element.attribs)) {
        const semantic = (element.name === "a" && attribute === "href") ||
          (element.name === "ol" && attribute === "start") ||
          (element.name === "li" && attribute === "value");
        if (!semantic) node.removeAttr(attribute);
      }
    }
  }

  for (const node of $.root().contents().toArray()) {
    if (node.type === "text") {
      if (node.data.trim()) $(node).wrap("<p></p>");
    } else if (node.type === "tag" && !BLOCK_TAGS.has(node.name)) {
      $(node).wrap("<p></p>");
    }
  }

  const blocks: string[] = [];
  const images: WebsiteImage[] = [];
  $.root().children().each((position, element) => {
    const block = $(element);
    const placeholders: string[] = [];
    block.find("img").each((_, image) => {
      const index = images.length + 1;
      const node = $(image);
      images.push({
        index,
        url: absoluteWebsiteImageUrl(node.attr("src") ?? "", baseUrl),
        alt: node.attr("alt") ?? "",
        position,
      });
      placeholders.push(`<p>[图片 ${index}]</p>`);
      node.remove();
    });
    for (const descendant of block.find("a,strong,em,p,li").toArray().reverse()) {
      const node = $(descendant);
      if (!node.contents().length) node.remove();
    }
    if (!placeholders.length || block.text().trim() || block.find("hr,br").length) {
      blocks.push($.html(element, { xml: { xmlMode: false, encodeEntities: "utf8" } }));
    }
    blocks.push(...placeholders);
  });
  return { html: blocks.join("\n"), images };
}
