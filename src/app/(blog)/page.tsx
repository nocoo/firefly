import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { listPosts } from "@/data/posts";
import { getSiteSettings } from "@/data/settings";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { SITE_URL, buildPageMeta, postPath } from "@/lib/seo";
import { websiteJsonLd, collectionPageJsonLd } from "@/lib/jsonld";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";

export async function generateMetadata(): Promise<Metadata> {
  const db = getDb();
  const [locale, settings] = await Promise.all([
    getLocale(),
    getSiteSettings(db),
  ]);
  const fullTitle = settings.siteTagline
    ? `${settings.siteName} – ${settings.siteTagline}`
    : settings.siteName;
  return buildPageMeta({
    title: fullTitle,
    description: settings.siteDescription,
    path: "/",
    locale,
  }, settings);
}

export default async function Home() {
  const locale = await getLocale();

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: websiteJsonLd(settings, locale) }}
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
            locale,
          ),
        }}
      />

      <section>
        {posts.length === 0 ? (
          <p className="py-12 text-center text-blog-muted">
            {t(locale, "blog.home.noPosts")}
          </p>
        ) : (
          posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              locale={locale}
              author={settings.siteAuthor}
              priority={i === 0 && !!post.featured_image}
            />
          ))
        )}
      </section>

      <Pagination
        currentPage={1}
        totalPages={totalPages}
        basePath="/"
        locale={locale}
      />
    </>
  );
}
