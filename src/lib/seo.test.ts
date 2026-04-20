import { describe, it, expect } from "vitest";
import {
  buildPageMeta,
  SITE_URL,
  HTML_LANG,
  OG_LOCALE,
  type SiteIdentity,
} from "./seo";

const testSite: SiteIdentity = {
  siteName: "Test Blog",
  siteTagline: "A test tagline",
  siteDescription: "A test blog description",
  siteAuthor: "Test Author",
  authorEmail: "test@example.com",
  twitterHandle: "@test",
};

describe("locale constants", () => {
  it("HTML_LANG is zh-CN", () => {
    expect(HTML_LANG).toBe("zh-CN");
  });

  it("OG_LOCALE is zh_CN", () => {
    expect(OG_LOCALE).toBe("zh_CN");
  });
});

describe("buildPageMeta", () => {
  it("uses zh-CN locale", () => {
    const meta = buildPageMeta({
      title: "Test",
      description: "Test description",
      path: "/test",
    }, testSite);

    expect(meta.openGraph?.locale).toBe("zh_CN");
    expect(meta.alternates?.languages).toEqual({ "zh-CN": `${SITE_URL}/test` });
  });

  it("sets canonical URL from path", () => {
    const meta = buildPageMeta({
      title: "Test",
      description: "Desc",
      path: "/2026/03/hello",
    }, testSite);

    expect(meta.alternates?.canonical).toBe(`${SITE_URL}/2026/03/hello`);
  });

  it("includes article metadata when type is article", () => {
    const meta = buildPageMeta({
      title: "Post",
      description: "Post desc",
      path: "/post",
      type: "article",
      publishedTime: "2026-03-24T00:00:00.000Z",
      modifiedTime: "2026-03-24T12:00:00.000Z",
    }, testSite);

    const og = meta.openGraph as Record<string, unknown>;
    expect(og.type).toBe("article");
    expect(og.publishedTime).toBe("2026-03-24T00:00:00.000Z");
    expect(og.authors).toEqual(["Test Author"]);
  });

  it("uses summary_large_image twitter card when image is provided", () => {
    const meta = buildPageMeta({
      title: "Test",
      description: "Desc",
      path: "/test",
      image: "https://example.com/img.jpg",
    }, testSite);

    const twitter = meta.twitter as Record<string, unknown>;
    expect(twitter.card).toBe("summary_large_image");
  });

  it("includes keywords when provided", () => {
    const meta = buildPageMeta({
      title: "Test",
      description: "Desc",
      path: "/test",
      keywords: ["react", "nextjs"],
    }, testSite);

    expect(meta.keywords).toEqual(["react", "nextjs"]);
  });

  it("uses site identity for author and siteName", () => {
    const meta = buildPageMeta({
      title: "Test",
      description: "Desc",
      path: "/test",
    }, testSite);

    expect(meta.authors).toEqual([{ name: "Test Author", url: SITE_URL }]);
    expect(meta.openGraph?.siteName).toBe("Test Blog");
  });

  it("uses authorOverride when provided", () => {
    const meta = buildPageMeta({
      title: "Test",
      description: "Desc",
      path: "/test",
      authorOverride: { name: "Claude Daily", url: `${SITE_URL}/agents/claude-daily` },
    }, testSite);

    expect(meta.authors).toEqual([{ name: "Claude Daily", url: `${SITE_URL}/agents/claude-daily` }]);
    expect(meta.openGraph?.siteName).toBe("Test Blog");
  });

  it("uses authorOverride in article OG authors", () => {
    const meta = buildPageMeta({
      title: "AI Post",
      description: "Desc",
      path: "/post",
      type: "article",
      publishedTime: "2026-03-24T00:00:00.000Z",
      authorOverride: { name: "Claude Daily", url: `${SITE_URL}/agents/claude-daily` },
    }, testSite);

    const og = meta.openGraph as Record<string, unknown>;
    expect(og.authors).toEqual(["Claude Daily"]);
  });

  it("omits twitter handle when empty", () => {
    const meta = buildPageMeta({
      title: "Test",
      description: "Desc",
      path: "/test",
    }, { ...testSite, twitterHandle: "" });

    const twitter = meta.twitter as Record<string, unknown>;
    expect(twitter.site).toBeUndefined();
    expect(twitter.creator).toBeUndefined();
  });
});

describe("title composition (regression)", () => {
  it("paginated page title should NOT contain siteName", () => {
    const page = 2;
    const title = `Page ${page}`;

    const meta = buildPageMeta({
      title,
      description: "Page 2",
      path: `/page/${page}`,
    }, testSite);

    expect(meta.title).toBe("Page 2");
    expect(meta.title).not.toContain(testSite.siteName);
  });

  it("category page title should NOT contain siteName", () => {
    const title = "JavaScript";
    const meta = buildPageMeta({
      title,
      description: "Posts in JavaScript",
      path: "/category/javascript",
    }, testSite);

    expect(meta.title).toBe("JavaScript");
    expect(meta.title).not.toContain(testSite.siteName);
  });

  it("article page title should NOT contain siteName", () => {
    const title = "How to Use React Hooks";
    const meta = buildPageMeta({
      title,
      description: "A guide to hooks",
      path: "/2026/03/react-hooks",
      type: "article",
    }, testSite);

    expect(meta.title).toBe("How to Use React Hooks");
    expect(meta.title).not.toContain(testSite.siteName);
  });

  it("OG title equals page title", () => {
    const meta = buildPageMeta({
      title: "Page 2",
      description: "Desc",
      path: "/page/2",
    }, testSite);

    const og = meta.openGraph as Record<string, unknown>;
    expect(og.title).toBe("Page 2");
  });
});
