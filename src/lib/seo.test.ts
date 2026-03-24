import { describe, it, expect } from "vitest";
import {
  ogLocale,
  htmlLang,
  buildPageMeta,
  SITE_URL,
} from "./seo";

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
    });

    expect(meta.openGraph?.locale).toBe("zh_CN");
    expect(meta.alternates?.languages).toEqual({ "zh-CN": `${SITE_URL}/test` });
  });

  it("uses en locale when specified", () => {
    const meta = buildPageMeta({
      title: "Test",
      description: "Test description",
      path: "/test",
      locale: "en",
    });

    expect(meta.openGraph?.locale).toBe("en_US");
    expect(meta.alternates?.languages).toEqual({ en: `${SITE_URL}/test` });
  });

  it("sets canonical URL from path", () => {
    const meta = buildPageMeta({
      title: "Test",
      description: "Desc",
      path: "/2026/03/hello",
    });

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
    });

    const og = meta.openGraph as Record<string, unknown>;
    expect(og.type).toBe("article");
    expect(og.publishedTime).toBe("2026-03-24T00:00:00.000Z");
  });

  it("uses summary_large_image twitter card when image is provided", () => {
    const meta = buildPageMeta({
      title: "Test",
      description: "Desc",
      path: "/test",
      image: "https://example.com/img.jpg",
    });

    const twitter = meta.twitter as Record<string, unknown>;
    expect(twitter.card).toBe("summary_large_image");
  });

  it("includes keywords when provided", () => {
    const meta = buildPageMeta({
      title: "Test",
      description: "Desc",
      path: "/test",
      keywords: ["react", "nextjs"],
    });

    expect(meta.keywords).toEqual(["react", "nextjs"]);
  });
});
