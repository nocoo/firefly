import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies — all vi.mock factories must be self-contained
// (hoisted above variable declarations).
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  getDb: () => ({} as never),
}));

vi.mock("@/lib/seo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/seo")>();
  return { ...actual, SITE_URL: "http://localhost:3000" };
});

vi.mock("@/data/settings", () => ({
  getSiteSettings: vi.fn().mockResolvedValue({
    locale: "en",
    postsPerPage: 10,
    commentsEnabled: false,
    fontStyle: "pingfang",
    siteLogoVersion: null,
    siteName: "Test Blog",
    siteTagline: "A test blog",
    siteDescription: "A blog about testing",
    siteAuthor: "Test Author",
    authorEmail: "test@example.com",
    twitterHandle: "",
    socialLinks: [],
    updatedAt: 1700000000,
  }),
}));

vi.mock("@/data/entities/post", () => ({
  listPosts: vi.fn().mockResolvedValue({
    posts: [
      {
        id: "p1",
        title: "First Post",
        slug: "first-post",
        content: "# Hello",
        content_html: "<h1>Hello</h1>",
        excerpt: "Hello world",
        status: "published",
        category_id: "cat-1",
        featured_image: null,
        published_at: 1700000000,
        created_at: 1700000000,
        updated_at: 1700000000,
        category_name: "General",
        category_slug: "general",
      },
      {
        id: "p2",
        title: 'Second Post with <Special> & "Chars"',
        slug: "second-post",
        content: "World",
        content_html: "<p>World</p>",
        excerpt: "World excerpt",
        status: "published",
        category_id: null,
        featured_image: null,
        published_at: 1700100000,
        created_at: 1700100000,
        updated_at: 1700100000,
        category_name: null,
        category_slug: null,
      },
    ],
    total: 2,
  }),
}));

vi.mock("@/i18n/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
}));

vi.mock("@/models/markdown", () => ({
  renderMarkdown: vi.fn((content: string) => `<p>${content}</p>`),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { GET } from "./route";

describe("GET /feed.xml", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with RSS content type", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/rss+xml; charset=utf-8",
    );
  });

  it("includes Cache-Control header", async () => {
    const response = await GET();
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=3600, s-maxage=3600",
    );
  });

  it("produces valid RSS 2.0 XML structure", async () => {
    const response = await GET();
    const xml = await response.text();

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain("<channel>");
    expect(xml).toContain("</channel>");
    expect(xml).toContain("</rss>");
  });

  it("uses site settings for channel metadata", async () => {
    const response = await GET();
    const xml = await response.text();

    expect(xml).toContain("<title>Test Blog</title>");
    expect(xml).toContain("<description>A blog about testing</description>");
    expect(xml).toContain("<language>en</language>");
  });

  it("includes managingEditor when authorEmail is set", async () => {
    const response = await GET();
    const xml = await response.text();

    expect(xml).toContain(
      "<managingEditor>test@example.com (Test Author)</managingEditor>",
    );
  });

  it("renders post items with correct fields", async () => {
    const response = await GET();
    const xml = await response.text();

    expect(xml).toContain("<![CDATA[First Post]]>");
    expect(xml).toContain("<![CDATA[Hello world]]>");
    expect(xml).toContain("<content:encoded><![CDATA[<h1>Hello</h1>]]>");
    expect(xml).toContain("<dc:creator><![CDATA[Test Author]]>");
    expect(xml).toContain("<![CDATA[General]]></category>");
  });

  it("handles posts with special characters in titles (via CDATA)", async () => {
    const response = await GET();
    const xml = await response.text();

    expect(xml).toContain(
      '<![CDATA[Second Post with <Special> & "Chars"]]>',
    );
  });

  it("omits category element when post has no category", async () => {
    const response = await GET();
    const xml = await response.text();

    // Second post has no category — should not have an empty <category> tag
    const secondItemIndex = xml.indexOf("second-post");
    const closingItemIndex = xml.indexOf("</item>", secondItemIndex);
    const secondItemSlice = xml.slice(secondItemIndex, closingItemIndex);
    expect(secondItemSlice).not.toContain("<category>");
  });

  it("includes atom:link self-reference", async () => {
    const response = await GET();
    const xml = await response.text();

    expect(xml).toContain(
      'atom:link href="http://localhost:3000/feed.xml" rel="self" type="application/rss+xml"',
    );
  });
});
