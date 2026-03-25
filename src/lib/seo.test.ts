import { describe, it, expect } from "vitest";
import {
  ogLocale,
  htmlLang,
  buildPageMeta,
  SITE_URL,
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

describe("ogLocale", () => {
  it("maps zh to zh_CN", () => {
    expect(ogLocale("zh")).toBe("zh_CN");
  });

  it("maps en to en_US", () => {
    expect(ogLocale("en")).toBe("en_US");
  });
});

describe("htmlLang", () => {
  it("maps zh to zh-CN", () => {
    expect(htmlLang("zh")).toBe("zh-CN");
  });

  it("maps en to en", () => {
    expect(htmlLang("en")).toBe("en");
  });
});

describe("buildPageMeta", () => {
  it("uses zh locale by default", () => {
    const meta = buildPageMeta({
      title: "Test",
      description: "Test description",
      path: "/test",
    }, testSite);

    expect(meta.openGraph?.locale).toBe("zh_CN");
    expect(meta.alternates?.languages).toEqual({ "zh-CN": `${SITE_URL}/test` });
  });

  it("uses en locale when specified", () => {
    const meta = buildPageMeta({
      title: "Test",
      description: "Test description",
      path: "/test",
      locale: "en",
    }, testSite);

    expect(meta.openGraph?.locale).toBe("en_US");
    expect(meta.alternates?.languages).toEqual({ en: `${SITE_URL}/test` });
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
