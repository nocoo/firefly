import type { Page } from "@playwright/test";
import sharp from "sharp";
import { test, expect, seedPostIdempotent } from "./fixtures";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:27028";
const publishedAt = Math.floor(Date.now() / 1000);
const seedId = `${Date.now()}-${process.pid}`;
const date = new Date(publishedAt * 1000);
const prefix = `/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}`;
const articles = [
  {
    title: '文章自己的标题：AI & "团队"',
    slug: `e2e-social-featured-${seedId}`,
    featured_image: `${BASE}/logo-80.png`,
  },
  {
    title: "An article without a featured image",
    slug: `e2e-social-fallback-${seedId}`,
    featured_image: null,
  },
];
const crawlers = [
  ["Facebook", "facebookexternalhit/1.1"],
  ["Teams", "SkypeUriPreview/1.0"],
  ["X", "Twitterbot/1.0"],
  ["LinkedIn", "LinkedInBot/1.0"],
  ["Slack", "Slackbot-LinkExpanding 1.0"],
  ["Discord", "Discordbot/2.0"],
  ["WhatsApp", "WhatsApp/2.24.1"],
] as const;

// Parse the HTTP response, not a hydrated page: link unfurlers often read only
// <head>, so a tag streamed later into <body> must fail this check.
async function readHead(page: Page, html: string) {
  return page.evaluate((markup) => {
    const doc = new DOMParser().parseFromString(markup, "text/html");
    const meta: Record<string, string[]> = {};
    for (const node of doc.head.querySelectorAll("meta")) {
      const name = node.getAttribute("property") ?? node.name;
      if (!name) continue;
      meta[name] ??= [];
      meta[name].push(node.content);
    }
    return {
      title: doc.title,
      meta,
      canonical: doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
      apple: doc.head.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.getAttribute("href"),
    };
  }, html);
}

test.describe("Feature: social previews without JavaScript", () => {
  test.beforeAll(async () => {
    // Keep published seeds until the runner resets its local D1, as other
    // parallel reading scenarios may have already discovered their URLs.
    for (const article of articles) {
      const post = {
        ...article,
        content: "A stable article for social preview regression checks.",
        status: "published" as const,
        published_at: publishedAt,
      };
      await seedPostIdempotent(BASE, post);
    }
  });

  for (const [platform, userAgent] of crawlers) {
    test(`${platform} sees the Journal homepage card in the initial HTML head`, async ({ request, page }) => {
      const response = await request.get("/", { headers: { "user-agent": userAgent } });
      expect(response.status()).toBe(200);
      expect(response.headers()["x-robots-tag"] ?? "").not.toMatch(/noindex|nofollow/);
      const { title, meta, canonical, apple } = await readHead(page, await response.text());
      expect(title).toBe("李征 — 博客");
      expect(meta["og:title"]).toEqual([title]);
      expect(meta["twitter:title"]).toEqual([title]);
      expect(meta["og:description"]).toEqual(meta.description);
      expect(meta["twitter:description"]).toEqual(meta.description);
      expect(meta["og:type"]).toEqual(["website"]);
      expect(meta["twitter:card"]).toEqual(["summary_large_image"]);
      expect(meta["og:image"]).toHaveLength(1);
      expect(meta["og:image"]?.[0]).toMatch(/^https?:\/\/[^/]+\/social\/journal-zh\.[a-f0-9]{12}\.jpg$/);
      expect(meta["twitter:image"]).toEqual(meta["og:image"]);
      expect(meta["og:image:width"]).toEqual(["1200"]);
      expect(meta["og:image:height"]).toEqual(["630"]);
      expect(meta["og:image:type"]).toEqual(["image/jpeg"]);
      expect(meta["og:image:alt"]?.[0]).toMatch(/李征/);
      expect(meta["twitter:image:alt"]).toEqual(meta["og:image:alt"]);
      expect(new URL(canonical!).pathname).toBe("/");
      expect(meta.robots?.[0]).toMatch(/index, follow/);
      expect(meta["theme-color"]).toEqual(["#f0f0e9", "#1e2824"]);
      expect(apple).toBe("/apple-touch-icon.png");
    });

    test(`${platform} keeps article titles and covers separate from the homepage`, async ({ request, page }) => {
      for (const article of articles) {
        const path = `${prefix}/${article.slug}`;
        const response = await request.get(path, { headers: { "user-agent": userAgent } });
        expect(response.status()).toBe(200);
        const { meta, canonical } = await readHead(page, await response.text());
        expect(meta["og:title"]).toEqual([article.title]);
        expect(meta["twitter:title"]).toEqual([article.title]);
        expect(meta["og:type"]).toEqual(["article"]);
        expect(meta["twitter:card"]).toEqual(["summary_large_image"]);
        expect(meta["og:image"]).toHaveLength(1);
        expect(meta["twitter:image"]).toEqual(meta["og:image"]);
        expect(new URL(canonical!).pathname).toBe(path);
        if (article.featured_image) {
          expect(meta["og:image"]).toEqual([article.featured_image]);
        } else {
          const image = new URL(meta["og:image"]![0]!);
          expect(image.pathname).toBe("/api/og");
          expect(image.searchParams.get("title")).toBe(article.title);
        }
      }
    });
  }

  test("share images and conventional browser icons are public raster files", async ({ request, page }) => {
    const response = await request.get("/", { headers: { "user-agent": "facebookexternalhit/1.1" } });
    const { meta } = await readHead(page, await response.text());
    // Fetch only through the isolated local server, even if AUTH_URL supplies
    // a public canonical origin while building the test artifact.
    const imagePath = new URL(meta["og:image"]![0]!).pathname;
    const image = await request.get(imagePath);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/jpeg");
    expect(image.headers()["cache-control"]).toContain("immutable");
    const bytes = await image.body();
    expect(bytes.byteLength).toBeLessThan(500 * 1024);
    expect(await sharp(bytes).metadata()).toMatchObject({ width: 1200, height: 630 });
    const head = await request.head(imagePath);
    expect(head.status()).toBe(200);
    expect(head.headers()["content-type"]).toContain("image/jpeg");
    expect(await head.body()).toHaveLength(0);
    for (const path of ["/apple-touch-icon.png", "/apple-touch-icon", "/apple-touch-icon-precomposed.png"]) {
      const icon = await request.get(path);
      expect(icon.status(), path).toBe(200);
      expect(icon.headers()["content-type"]).toContain("image/png");
      expect(await sharp(await icon.body()).metadata()).toMatchObject({ width: 180, height: 180 });
    }
    const favicon = await request.get("/favicon.ico");
    expect(favicon.status()).toBe(200);
    expect(favicon.headers()["content-type"]).toContain("image/x-icon");
    const fallback = await request.get(`/api/og?title=${encodeURIComponent(articles[1]!.title)}`);
    expect(fallback.status()).toBe(200);
    expect(fallback.headers()["content-type"]).toContain("image/png");
    expect(await sharp(await fallback.body()).metadata()).toMatchObject({ width: 1200, height: 630 });
  });
});
