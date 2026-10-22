import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArticleBody } from "./article-body";

describe("article podcast placement", () => {
  it("places playback below the cover and before reference/body content", () => {
    const html = renderToStaticMarkup(createElement(ArticleBody, {
      header: "ARTICLE_HEADER",
      featuredImage: "ARTICLE_COVER",
      podcastPlayer: "ARTICLE_PLAYER",
      referenceCard: "ARTICLE_REFERENCE",
      html: "ARTICLE_BODY",
    }));
    expect(html).toMatch(/ARTICLE_HEADER.*ARTICLE_COVER.*ARTICLE_PLAYER.*ARTICLE_REFERENCE.*ARTICLE_BODY/);
  });

  it("keeps playback below the header when the article has no cover", () => {
    const html = renderToStaticMarkup(createElement(ArticleBody, {
      header: "ARTICLE_HEADER", podcastPlayer: "ARTICLE_PLAYER", html: "ARTICLE_BODY",
    }));
    expect(html).toMatch(/ARTICLE_HEADER.*ARTICLE_PLAYER.*ARTICLE_BODY/);
  });
});
