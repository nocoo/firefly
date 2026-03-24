import { describe, it, expect } from "vitest";
import { websiteJsonLd, blogPostingJsonLd, breadcrumbJsonLd } from "./jsonld";
import type { PostWithCategory } from "@/models/types";

describe("websiteJsonLd", () => {
  it("uses zh-CN inLanguage by default", () => {
    const result = JSON.parse(websiteJsonLd());
    expect(result.inLanguage).toBe("zh-CN");
    expect(result["@type"]).toBe("WebSite");
  });

  it("uses en inLanguage when locale is en", () => {
    const result = JSON.parse(websiteJsonLd("en"));
    expect(result.inLanguage).toBe("en");
  });

  it("includes site name and URL", () => {
    const result = JSON.parse(websiteJsonLd());
    expect(result.name).toBe("LIZHENG.ME");
    expect(result.url).toBe("https://lizheng.me");
  });
});

describe("blogPostingJsonLd", () => {
  const post: PostWithCategory = {
    id: "1",
    title: "Test Post",
    slug: "test-post",
    content: "# Hello",
    content_html: "<h1>Hello</h1>",
    excerpt: "A test post",
    status: "published",
    featured_image: "https://assets.lizheng.me/test.jpg",
    comment_enabled: 1,
    comment_count: 0,
    view_count: 0,
    reading_time: 5,
    wp_id: null,
    wp_permalink: null,
    published_at: 1711238400, // 2024-03-24
    created_at: 1711238400,
    updated_at: 1711324800,
    category_id: "cat1",
    category_name: "Tech",
    category_slug: "tech",
  };

  it("uses zh-CN inLanguage by default", () => {
    const result = JSON.parse(blogPostingJsonLd(post));
    expect(result.inLanguage).toBe("zh-CN");
  });

  it("uses en inLanguage when locale is en", () => {
    const result = JSON.parse(blogPostingJsonLd(post, undefined, "en"));
    expect(result.inLanguage).toBe("en");
  });

  it("includes headline and URL", () => {
    const result = JSON.parse(blogPostingJsonLd(post));
    expect(result.headline).toBe("Test Post");
    expect(result["@type"]).toBe("BlogPosting");
  });

  it("includes keywords when provided", () => {
    const result = JSON.parse(blogPostingJsonLd(post, ["react", "nextjs"]));
    expect(result.keywords).toBe("react, nextjs");
  });

  it("includes article section from category", () => {
    const result = JSON.parse(blogPostingJsonLd(post));
    expect(result.articleSection).toBe("Tech");
  });

  it("includes reading time", () => {
    const result = JSON.parse(blogPostingJsonLd(post));
    expect(result.timeRequired).toBe("PT5M");
  });
});

describe("breadcrumbJsonLd", () => {
  it("generates correct breadcrumb list", () => {
    const items = [
      { name: "Home", href: "/" },
      { name: "Tech", href: "/category/tech" },
      { name: "My Post", href: "/2026/03/my-post" },
    ];
    const result = JSON.parse(breadcrumbJsonLd(items));

    expect(result["@type"]).toBe("BreadcrumbList");
    expect(result.itemListElement).toHaveLength(3);
    expect(result.itemListElement[0].position).toBe(1);
    expect(result.itemListElement[2].name).toBe("My Post");
  });
});
