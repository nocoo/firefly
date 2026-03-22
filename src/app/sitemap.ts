import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { listPosts } from "@/data/posts";
import { listCategories } from "@/data/categories";
import { listTags } from "@/data/tags";
import { SITE_URL, postPath } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getDb();

  const [{ posts }, categories, tags] = await Promise.all([
    listPosts(db, { status: "published", pageSize: 250 }),
    listCategories(db),
    listTags(db),
  ]);

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}${postPath(post.slug, post.published_at)}`,
    lastModified: new Date(post.updated_at * 1000),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const categoryEntries: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${SITE_URL}/category/${cat.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const tagEntries: MetadataRoute.Sitemap = tags.map((tag) => ({
    url: `${SITE_URL}/tag/${tag.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...postEntries,
    ...categoryEntries,
    ...tagEntries,
  ];
}
