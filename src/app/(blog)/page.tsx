import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { listPosts } from "@/data/entities/post";
import { getSiteSettings } from "@/data/settings";
import { loadSiteIdentity } from "@/lib/site-identity";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { SITE_URL, buildHomeMeta, postPath } from "@/lib/seo";
import { websiteJsonLd, collectionPageJsonLd } from "@/lib/jsonld";
import { ListOriginTracker } from "@/components/blog/list-origin-tracker";
import { EmptyState } from "@/components/blog/empty-state";
import { FileText } from "lucide-react";
import { getPostAuthor } from "@/lib/ai-agent/author";
import { JournalIntro } from "@/components/blog/journal-intro";
import homeSocial from "@/lib/home-social.json";

export async function generateMetadata(): Promise<Metadata> {
  const db = getDb();
  const settings = await getSiteSettings(db);

  return buildHomeMeta(settings);
}

export default async function Home() {
  const db = getDb();
  const { settings, identity } = await loadSiteIdentity(db);
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
        dangerouslySetInnerHTML={{ __html: websiteJsonLd({ ...identity, siteDescription: homeSocial.description }) }}
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

      <JournalIntro siteName={settings.siteName} tagline={settings.siteTagline} total={total} />
      <section className="journal-posts" aria-label="最近文章">
        {posts.length === 0 ? (
          <EmptyState icon={FileText} message="暂无文章。" />
        ) : (
          posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              author={getPostAuthor(post)}
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
