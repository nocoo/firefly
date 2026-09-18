import { getDb } from "@/lib/db";
import { listPosts, listCategories, getSiteSettings, getDefaultHuman } from "@/data/public-content";
import { SITE_URL, postPath } from "@/lib/seo";

export async function GET() {
  const db = getDb();
  const [{ posts }, categories, settings, defaultHuman] = await Promise.all([
    listPosts(db, { status: "published", pageSize: 30 }),
    listCategories(db),
    getSiteSettings(db),
    getDefaultHuman(db),
  ]);

  const lines = [
    `# ${defaultHuman?.name || settings.siteName}`,
    "",
    settings.siteDescription ? `> ${settings.siteDescription}` : "",
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
  ].filter((line) => line !== undefined);

  const markdown = lines.join("\n");
  const tokenEstimate = Math.ceil(markdown.length / 4);

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "x-markdown-tokens": String(tokenEstimate),
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
