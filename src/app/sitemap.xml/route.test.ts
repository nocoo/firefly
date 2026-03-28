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

vi.mock("@/data/entities/post", () => ({
  listPosts: vi.fn().mockResolvedValue({
    posts: [
      {
        id: "p1",
        title: "First Post",
        slug: "first-post",
        status: "published",
        featured_image: "https://cdn.example.com/img.jpg",
        published_at: 1700000000,
        updated_at: 1710000000,
        category_name: "General",
        category_slug: "general",
      },
      {
        id: "p2",
        title: "Second Post",
        slug: "second-post",
        status: "published",
        featured_image: null,
        published_at: 1700100000,
        updated_at: 1700100000,
        category_name: null,
        category_slug: null,
      },
    ],
    total: 2,
  }),
  listMonthlyArchives: vi.fn().mockResolvedValue([
    { year: 2023, month: 11, count: 2 },
  ]),
}));

vi.mock("@/data/entities/category", () => ({
  listCategories: vi.fn().mockResolvedValue([
    { id: "cat-1", name: "General", slug: "general", description: null, post_count: 5 },
    { id: "cat-2", name: "Empty", slug: "empty", description: null, post_count: 0 },
  ]),
}));

vi.mock("@/data/entities/tag", () => ({
  listTags: vi.fn().mockResolvedValue([
    { id: "t1", name: "JavaScript", slug: "javascript", post_count: 5 },
    { id: "t2", name: "CSS", slug: "css", post_count: 2 },
    { id: "t3", name: "React", slug: "react", post_count: 10 },
  ]),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { GET } from "./route";

describe("GET /sitemap.xml", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with XML content type", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/xml; charset=utf-8",
    );
  });

  it("includes Cache-Control header", async () => {
    const response = await GET();
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=3600, s-maxage=3600",
    );
  });

  it("produces valid sitemap XML structure", async () => {
    const response = await GET();
    const xml = await response.text();

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    );
    expect(xml).toContain("</urlset>");
  });

  it("includes home page with priority 1.0", async () => {
    const response = await GET();
    const xml = await response.text();

    expect(xml).toContain("<loc>http://localhost:3000</loc>");
    expect(xml).toContain("<priority>1.0</priority>");
    expect(xml).toContain("<changefreq>daily</changefreq>");
  });

  it("includes posts with date-based URLs and priority 0.8", async () => {
    const response = await GET();
    const xml = await response.text();

    // Nov 14, 2023 → /2023/11/first-post
    expect(xml).toContain(
      "<loc>http://localhost:3000/2023/11/first-post</loc>",
    );
    expect(xml).toContain(
      "<loc>http://localhost:3000/2023/11/second-post</loc>",
    );
    const postPriorityMatches = xml.match(/<priority>0\.8<\/priority>/g);
    expect(postPriorityMatches?.length).toBe(2);
  });

  it("includes featured image in sitemap image namespace", async () => {
    const response = await GET();
    const xml = await response.text();

    expect(xml).toContain("<image:image>");
    expect(xml).toContain(
      "<image:loc>https://cdn.example.com/img.jpg</image:loc>",
    );
    expect(xml).toContain("<image:title>First Post</image:title>");
  });

  it("includes categories with posts (excludes empty categories)", async () => {
    const response = await GET();
    const xml = await response.text();

    expect(xml).toContain(
      "<loc>http://localhost:3000/category/general</loc>",
    );
    expect(xml).not.toContain(
      "<loc>http://localhost:3000/category/empty</loc>",
    );
  });

  it("includes tags with >= 3 posts (excludes thin-content tags)", async () => {
    const response = await GET();
    const xml = await response.text();

    expect(xml).toContain(
      "<loc>http://localhost:3000/tag/javascript</loc>",
    );
    expect(xml).toContain(
      "<loc>http://localhost:3000/tag/react</loc>",
    );
    // CSS has only 2 posts → excluded
    expect(xml).not.toContain(
      "<loc>http://localhost:3000/tag/css</loc>",
    );
  });

  it("includes archive entries", async () => {
    const response = await GET();
    const xml = await response.text();

    expect(xml).toContain(
      "<loc>http://localhost:3000/archive/2023-11</loc>",
    );
  });

  it("includes XSL stylesheet processing instruction", async () => {
    const response = await GET();
    const xml = await response.text();

    expect(xml).toContain(
      '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>',
    );
  });
});
