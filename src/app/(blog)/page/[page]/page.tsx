import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { listPosts } from "@/data/posts";
import { getSiteSettings } from "@/data/settings";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { buildPageMeta, SITE_URL, postPath } from "@/lib/seo";
import { collectionPageJsonLd } from "@/lib/jsonld";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";
import { ListOriginTracker } from "@/components/blog/list-origin-tracker";

interface PageProps {
  params: Promise<{ page: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (Number.isNaN(page) || page < 2) return { title: "Not Found" };

  const db = getDb();
  const [locale, settings] = await Promise.all([
    getLocale(),
    getSiteSettings(db),
  ]);
  return buildPageMeta({
    title: `Page ${page}`,
    description: `${settings.siteDescription} — Page ${page}`,
    path: `/page/${page}`,
    locale,
  }, settings);
}

export default async function HomePaged({ params }: PageProps) {
  const { page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (Number.isNaN(page) || page < 2) notFound();

  const locale = await getLocale();

  const db = getDb();
  const settings = await getSiteSettings(db);
  const { posts, total } = await listPosts(db, {
    status: "published",
    page,
    pageSize: settings.postsPerPage,
  });

  const totalPages = Math.ceil(total / settings.postsPerPage);
  if (page > totalPages) notFound();

  return (
    <>
      <ListOriginTracker />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: collectionPageJsonLd(
            `${settings.siteName} – Page ${page}`,
            `/page/${page}`,
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
        currentPage={page}
        totalPages={totalPages}
        basePath="/"
        locale={locale}
      />
    </>
  );
}
