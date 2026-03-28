import { getDb } from "@/lib/db";
import { listPosts } from "@/data/entities/post";
import { getSiteSettings } from "@/data/settings";
import { renderMarkdown } from "@/models/markdown";
import { SITE_URL, postPath, htmlLang } from "@/lib/seo";
import { getLocale } from "@/i18n/server";
import { escapeXml } from "@/lib/xml";

export async function GET() {
  const db = getDb();
  const [{ posts }, locale, settings] = await Promise.all([
    listPosts(db, {
      status: "published",
      pageSize: 50,
    }),
    getLocale(),
    getSiteSettings(db),
  ]);

  const items = posts.map((post) => {
    const url = `${SITE_URL}${postPath(post.slug, post.published_at)}`;
    const pubDate = post.published_at
      ? new Date(post.published_at * 1000).toUTCString()
      : new Date(post.created_at * 1000).toUTCString();
    const html = post.content_html || renderMarkdown(post.content);

    return `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator><![CDATA[${settings.siteAuthor}]]></dc:creator>
      <description><![CDATA[${post.excerpt ?? ""}]]></description>
      <content:encoded><![CDATA[${html}]]></content:encoded>
      ${post.category_name ? `<category><![CDATA[${post.category_name}]]></category>` : ""}
    </item>`;
  });

  const managingEditor = settings.authorEmail
    ? `<managingEditor>${escapeXml(settings.authorEmail)} (${escapeXml(settings.siteAuthor)})</managingEditor>`
    : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(settings.siteName)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(settings.siteDescription)}</description>
    <language>${htmlLang(locale)}</language>
    ${managingEditor}
    <ttl>60</ttl>
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
