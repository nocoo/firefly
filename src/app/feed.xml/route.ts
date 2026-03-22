import { getDb } from "@/lib/db";
import { listPosts } from "@/data/posts";
import { renderMarkdown } from "@/models/markdown";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, postPath } from "@/lib/seo";

export async function GET() {
  const db = getDb();
  const { posts } = await listPosts(db, {
    status: "published",
    pageSize: 50,
  });

  const items = posts.map((post) => {
    const url = `${SITE_URL}${postPath(post.slug, post.published_at)}`;
    const pubDate = post.published_at
      ? new Date(post.published_at * 1000).toUTCString()
      : new Date(post.created_at * 1000).toUTCString();
    const html = renderMarkdown(post.content);

    return `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${post.excerpt ?? ""}]]></description>
      <content:encoded><![CDATA[${html}]]></content:encoded>
      ${post.category_name ? `<category>${post.category_name}</category>` : ""}
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_NAME}</title>
    <link>${SITE_URL}</link>
    <description>${SITE_DESCRIPTION}</description>
    <language>zh-CN</language>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.join("\n")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
