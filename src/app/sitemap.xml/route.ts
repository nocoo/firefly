import { getDb } from "@/lib/db";
import { listPosts, listMonthlyArchives } from "@/data/entities/post";
import { listCategories } from "@/data/entities/category";
import { listTags } from "@/data/entities/tag";
import { SITE_URL, postPath } from "@/lib/seo";
import { escapeXml } from "@/lib/xml";

interface SitemapEntry {
  url: string;
  lastModified?: Date;
  changeFrequency?: string;
  priority: number;
  image?: { url: string; title: string };
}

export async function GET() {
  const db = getDb();

  const [{ posts }, categories, tags, archives] = await Promise.all([
    listPosts(db, { status: "published", pageSize: 50000 }),
    listCategories(db),
    listTags(db),
    listMonthlyArchives(db),
  ]);

  const entries: SitemapEntry[] = [];

  // Home — lastmod = most recently updated post (not first by published_at)
  const maxUpdatedAt = posts.reduce(
    (max, p) => Math.max(max, p.updated_at),
    0,
  );
  const latestPostDate = maxUpdatedAt > 0
    ? new Date(maxUpdatedAt * 1000)
    : new Date();
  entries.push({
    url: SITE_URL,
    lastModified: latestPostDate,
    changeFrequency: "daily",
    priority: 1,
  });

  // Posts
  for (const post of posts) {
    entries.push({
      url: `${SITE_URL}${postPath(post.slug, post.published_at)}`,
      lastModified: new Date(post.updated_at * 1000),
      changeFrequency: "monthly",
      priority: 0.8,
      ...(post.featured_image
        ? { image: { url: post.featured_image, title: post.title } }
        : {}),
    });
  }

  // Categories
  for (const cat of categories) {
    if (cat.post_count > 0) {
      entries.push({
        url: `${SITE_URL}/category/${cat.slug}`,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  // Tags (exclude thin-content tags with fewer than 3 posts)
  for (const tag of tags) {
    if (tag.post_count >= 3) {
      entries.push({
        url: `${SITE_URL}/tag/${tag.slug}`,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  // Archives
  for (const a of archives) {
    const period = `${a.year}-${String(a.month).padStart(2, "0")}`;
    entries.push({
      url: `${SITE_URL}/archive/${period}`,
      changeFrequency: "monthly",
      priority: 0.4,
    });
  }

  const xml = buildSitemapXml(entries);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

function buildSitemapXml(entries: SitemapEntry[]): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  ];

  for (const entry of entries) {
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(entry.url)}</loc>`);
    if (entry.lastModified) {
      lines.push(`    <lastmod>${entry.lastModified.toISOString().split("T")[0]}</lastmod>`);
    }
    if (entry.changeFrequency) {
      lines.push(`    <changefreq>${entry.changeFrequency}</changefreq>`);
    }
    lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
    if (entry.image) {
      lines.push("    <image:image>");
      lines.push(`      <image:loc>${escapeXml(entry.image.url)}</image:loc>`);
      lines.push(`      <image:title>${escapeXml(entry.image.title)}</image:title>`);
      lines.push("    </image:image>");
    }
    lines.push("  </url>");
  }

  lines.push("</urlset>");
  return lines.join("\n");
}

