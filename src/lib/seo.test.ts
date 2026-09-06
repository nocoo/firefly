import { describe, it, expect } from "vitest";
import {
  buildPageMeta,
  buildHomeMeta,
  twitterAccountMeta,
  SITE_URL,
  HTML_LANG,
  OG_LOCALE,
  formatDate,
  formatDateDisplay,
  formatDateISO,
  extractYearMonth,
  postPath,
  type SiteIdentity,
} from "./seo";
import homeSocial from "./home-social.json";

const testSite: SiteIdentity = {
  siteName: "Test Blog",
  siteTagline: "A test tagline",
  siteDescription: "A test blog description",
  siteAuthor: "Test Author",
  authorEmail: "test@example.com",
  twitterHandle: "@test",
};

describe("homepage social metadata", () => {
  it("uses an absolute title and an explicit large image instead of the root app logo", () => {
    const meta = buildHomeMeta(testSite);
    expect(meta.title).toEqual({ absolute: "李征 — 博客" });
    expect(meta.openGraph).toMatchObject({
      title: "李征 — 博客",
      description: meta.description,
      type: "website",
      siteName: testSite.siteName,
      images: [{
        url: new URL(homeSocial.image.url, SITE_URL).href,
        width: 1200, height: 630, type: "image/jpeg", alt: homeSocial.image.alt,
      }],
    });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", title: "李征 — 博客" });
    expect(meta.alternates?.canonical).toBe(SITE_URL);
  });

  it("keeps article titles and featured images independent of the homepage", () => {
    const meta = buildPageMeta({
      title: "文章自己的标题", description: "文章自己的摘要", path: "/2026/09/article",
      type: "article", image: "https://images.example.com/cover.jpg",
    }, testSite);
    expect(meta.openGraph).toMatchObject({
      title: "文章自己的标题", type: "article",
      images: [{ url: "https://images.example.com/cover.jpg" }],
    });
    expect(meta.twitter).toMatchObject({
      title: "文章自己的标题", images: ["https://images.example.com/cover.jpg"],
    });
  });
});

describe("Twitter account metadata", () => {
  it.each(["zhengli", "@zhengli", "  @zhengli  "])("normalizes %s", (value) => {
    expect(twitterAccountMeta(value)).toEqual({ site: "@zhengli", creator: "@zhengli" });
  });
  it.each(["", "   ", "@"])("omits the empty account %s", (value) => {
    expect(twitterAccountMeta(value)).toEqual({});
  });
});

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

describe("date helpers", () => {
  const epoch = Date.UTC(2026, 0, 15) / 1000;

  it("formatDate returns YYYY-MM-DD", () => {
    expect(formatDate(epoch)).toBe("2026-01-15");
  });

  it("formatDateDisplay returns Chinese long-form date", () => {
    expect(formatDateDisplay(epoch)).toBe("2026年1月15日");
  });

  it("formatDateISO returns ISO 8601", () => {
    expect(formatDateISO(epoch)).toBe("2026-01-15T00:00:00.000Z");
  });

  it("extractYearMonth zero-pads single-digit months", () => {
    expect(extractYearMonth(epoch)).toEqual({ year: "2026", month: "01" });
    expect(extractYearMonth(Date.UTC(2026, 9, 5) / 1000)).toEqual({
      year: "2026",
      month: "10",
    });
  });
});

describe("postPath", () => {
  it("returns /slug for unpublished posts (null)", () => {
    expect(postPath("hello", null)).toBe("/hello");
  });

  it("treats publishedAt=0 as unpublished", () => {
    expect(postPath("hello", 0)).toBe("/hello");
  });

  it("returns /YYYY/MM/slug for published posts", () => {
    const epoch = Date.UTC(2026, 2, 1) / 1000;
    expect(postPath("hello", epoch)).toBe("/2026/03/hello");
  });
});
