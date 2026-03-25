import { describe, it, expect } from "vitest";
import { websiteJsonLd, blogPostingJsonLd, breadcrumbJsonLd, collectionPageJsonLd } from "./jsonld";
import { SITE_URL, type SiteIdentity } from "./seo";
import type { PostWithCategory } from "@/models/types";

const testSite: SiteIdentity = {
  siteName: "Test Blog",
  siteTagline: "A test tagline",
  siteDescription: "A test blog description",
  siteAuthor: "Test Author",
  authorEmail: "test@example.com",
  twitterHandle: "@test",
};

describe("websiteJsonLd", () => {
  it("uses zh-CN inLanguage by default", () => {
    const result = JSON.parse(websiteJsonLd(testSite));
    expect(result.inLanguage).toBe("zh-CN");
    expect(result["@type"]).toBe("WebSite");
  });

  it("uses en inLanguage when locale is en", () => {
    const result = JSON.parse(websiteJsonLd(testSite, "en"));
    expect(result.inLanguage).toBe("en");
  });

  it("includes site name and URL from identity", () => {
    const result = JSON.parse(websiteJsonLd(testSite));
    expect(result.name).toBe("Test Blog");
    expect(result.url).toBe(SITE_URL);
    expect(result.description).toBe("A test blog description");
    expect(result.author.name).toBe("Test Author");
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
    featured_image: "https://example.com/test.jpg",
    comment_enabled: 1,
    comment_count: 0,
    view_count: 0,
    reading_time: 5,
    wp_id: null,
    wp_permalink: null,
    reference_url: null,
    reference_title: null,
    reference_description: null,
    reference_image: null,
    published_at: 1711238400, // 2024-03-24
    created_at: 1711238400,
    updated_at: 1711324800,
    category_id: "cat1",
    category_name: "Tech",
    category_slug: "tech",
  };

  it("uses zh-CN inLanguage by default", () => {
    const result = JSON.parse(blogPostingJsonLd(post, testSite));
    expect(result.inLanguage).toBe("zh-CN");
  });

  it("uses en inLanguage when locale is en", () => {
    const result = JSON.parse(blogPostingJsonLd(post, testSite, undefined, "en"));
    expect(result.inLanguage).toBe("en");
  });

  it("includes headline and URL", () => {
    const result = JSON.parse(blogPostingJsonLd(post, testSite));
    expect(result.headline).toBe("Test Post");
    expect(result["@type"]).toBe("BlogPosting");
  });

  it("uses site identity for author and publisher", () => {
    const result = JSON.parse(blogPostingJsonLd(post, testSite));
    expect(result.author.name).toBe("Test Author");
    expect(result.publisher.name).toBe("Test Author");
  });

  it("includes keywords when provided", () => {
    const result = JSON.parse(blogPostingJsonLd(post, testSite, ["react", "nextjs"]));
    expect(result.keywords).toBe("react, nextjs");
  });

  it("includes article section from category", () => {
    const result = JSON.parse(blogPostingJsonLd(post, testSite));
    expect(result.articleSection).toBe("Tech");
  });

  it("includes reading time", () => {
    const result = JSON.parse(blogPostingJsonLd(post, testSite));
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

describe("collectionPageJsonLd", () => {
  it("generates CollectionPage with ItemList", () => {
    const items = [
      { url: `${SITE_URL}/2026/03/post-1`, name: "Post 1" },
      { url: `${SITE_URL}/2026/03/post-2`, name: "Post 2" },
    ];
    const result = JSON.parse(collectionPageJsonLd("Tech", "/category/tech", items));

    expect(result["@type"]).toBe("CollectionPage");
    expect(result.name).toBe("Tech");
    expect(result.mainEntity["@type"]).toBe("ItemList");
    expect(result.mainEntity.numberOfItems).toBe(2);
    expect(result.mainEntity.itemListElement).toHaveLength(2);
    expect(result.mainEntity.itemListElement[0].position).toBe(1);
    expect(result.mainEntity.itemListElement[1].name).toBe("Post 2");
  });

  it("uses zh-CN inLanguage by default", () => {
    const result = JSON.parse(collectionPageJsonLd("Test", "/test", []));
    expect(result.inLanguage).toBe("zh-CN");
  });

  it("uses en inLanguage when locale is en", () => {
    const result = JSON.parse(collectionPageJsonLd("Test", "/test", [], "en"));
    expect(result.inLanguage).toBe("en");
  });
});
