import { getDb } from "@/lib/db";
import { listPosts } from "@/data/posts";
import { listCategories } from "@/data/categories";
import { SITE_URL, postPath } from "@/lib/seo";

export async function GET() {
  const db = getDb();
  const [{ posts }, categories] = await Promise.all([
    listPosts(db, { status: "published", pageSize: 250 }),
    listCategories(db),
  ]);

  const lines = [
    "# Li Zheng",
    "",
    "> Personal blog by Li Zheng — technology, design, and life.",
    "",
    `This site is a personal blog at ${SITE_URL}.`,
    "",
    "## Categories",
    "",
    ...categories.map(
      (cat) => `- [${cat.name}](${SITE_URL}/category/${cat.slug})`,
    ),
    "",
    "## Recent Posts",
    "",
    ...posts.slice(0, 30).map((post) => {
      const url = `${SITE_URL}${postPath(post.slug, post.published_at)}`;
      return `- [${post.title}](${url})`;
    }),
    "",
    "## Feeds",
    "",
    `- RSS: ${SITE_URL}/feed.xml`,
    `- Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
