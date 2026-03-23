import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { listPosts } from "@/data/posts";
import { getSiteSettings } from "@/data/settings";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { SITE_NAME, SITE_DESCRIPTION, buildPageMeta } from "@/lib/seo";
import { websiteJsonLd } from "@/lib/jsonld";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";

export function generateMetadata(): Metadata {
  return buildPageMeta({
    title: `${SITE_NAME} – 知白守黑，不语万千算`,
    description: SITE_DESCRIPTION,
    path: "/",
  });
}

export default async function Home() {
  const locale = await getLocale();

  const db = getDb();
  const { postsPerPage } = await getSiteSettings(db);
  const { posts, total } = await listPosts(db, {
    status: "published",
    page: 1,
    pageSize: postsPerPage,
  });

  const totalPages = Math.ceil(total / postsPerPage);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: websiteJsonLd() }}
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
        currentPage={1}
        totalPages={totalPages}
        basePath="/"
        locale={locale}
      />
    </>
  );
}
