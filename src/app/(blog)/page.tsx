import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { listPosts } from "@/data/entities/post";
import { getSiteSettings } from "@/data/settings";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { SITE_URL, OG_LOCALE, HTML_LANG, postPath } from "@/lib/seo";
import { websiteJsonLd, collectionPageJsonLd } from "@/lib/jsonld";
import { ListOriginTracker } from "@/components/blog/list-origin-tracker";
import { EmptyState } from "@/components/blog/empty-state";
import { FileText } from "lucide-react";
import { getPostAuthor } from "@/lib/ai-agent/author";

export async function generateMetadata(): Promise<Metadata> {
  const db = getDb();
  const settings = await getSiteSettings(db);

  // Do NOT set a page-level title here — the root layout defines
  // title.default = "SiteName – Tagline" which is used automatically.
  // Setting a title here would cause duplication via the template
  // "%s | SiteName".
  const fullTitle = settings.siteTagline
    ? `${settings.siteName} – ${settings.siteTagline}`
    : settings.siteName;

  const description =
    settings.siteDescription || settings.siteTagline || undefined;

  return {
    description,
    alternates: {
      canonical: SITE_URL,
      languages: { [HTML_LANG]: SITE_URL },
    },
    openGraph: {
      title: fullTitle,
      description,
      url: SITE_URL,
      siteName: settings.siteName,
      locale: OG_LOCALE,
      type: "website",
    },
    twitter: {
      card: "summary",
      ...(settings.twitterHandle ? { site: settings.twitterHandle } : {}),
      ...(settings.twitterHandle ? { creator: settings.twitterHandle } : {}),
      title: fullTitle,
      description,
    },
  };
}

export default async function Home() {
  const db = getDb();
  const settings = await getSiteSettings(db);
  const { posts, total } = await listPosts(db, {
    status: "published",
    page: 1,
    pageSize: settings.postsPerPage,
  });

  const totalPages = Math.ceil(total / settings.postsPerPage);

  return (
    <>
      <ListOriginTracker />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: websiteJsonLd(settings) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: collectionPageJsonLd(
            settings.siteName,
            "/",
            posts.map((p) => ({
              url: `${SITE_URL}${postPath(p.slug, p.published_at)}`,
              name: p.title,
            })),
          ),
        }}
      />

      <section>
        {posts.length === 0 ? (
          <EmptyState icon={FileText} message="暂无文章。" />
        ) : (
          posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              author={getPostAuthor(post, settings)}
              priority={i === 0 && !!post.featured_image}
            />
          ))
        )}
      </section>

      <Pagination
        currentPage={1}
        totalPages={totalPages}
        basePath="/"
      />
    </>
  );
}
