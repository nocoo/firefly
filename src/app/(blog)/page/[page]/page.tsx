import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { listPosts } from "@/data/posts";
import { getSiteSettings } from "@/data/settings";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { buildPageMeta, SITE_NAME, SITE_URL, SITE_DESCRIPTION, postPath } from "@/lib/seo";
import { collectionPageJsonLd } from "@/lib/jsonld";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";

interface PageProps {
  params: Promise<{ page: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (Number.isNaN(page) || page < 2) return { title: "Not Found" };

  const locale = await getLocale();
  return buildPageMeta({
    title: `${SITE_NAME} – Page ${page}`,
    description: `${SITE_DESCRIPTION} — Page ${page}`,
    path: `/page/${page}`,
    locale,
  });
}

export default async function HomePaged({ params }: PageProps) {
  const { page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (Number.isNaN(page) || page < 2) notFound();

  const locale = await getLocale();

  const db = getDb();
  const { postsPerPage } = await getSiteSettings(db);
  const { posts, total } = await listPosts(db, {
    status: "published",
    page,
    pageSize: postsPerPage,
  });

  const totalPages = Math.ceil(total / postsPerPage);
  if (page > totalPages) notFound();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: collectionPageJsonLd(
            `${SITE_NAME} – Page ${page}`,
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
