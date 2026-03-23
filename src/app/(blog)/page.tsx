import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { listPosts } from "@/data/posts";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { SITE_NAME, SITE_DESCRIPTION, buildPageMeta } from "@/lib/seo";
import { websiteJsonLd } from "@/lib/jsonld";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";

const PAGE_SIZE = 20;

interface HomeProps {
  searchParams: Promise<{ page?: string; archive?: string }>;
}

export function generateMetadata(): Metadata {
  return buildPageMeta({
    title: `${SITE_NAME} – 知白守黑，不语万千算`,
    description: SITE_DESCRIPTION,
    path: "/",
  });
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const locale = await getLocale();

  // Parse archive filter: "2026-02" (year-month) or "2024" (year only)
  let archiveYear: number | undefined;
  let archiveMonth: number | undefined;
  if (params.archive) {
    const parts = params.archive.split("-");
    const y = parseInt(parts[0], 10);
    if (!Number.isNaN(y)) {
      archiveYear = y;
      if (parts[1]) {
        const m = parseInt(parts[1], 10);
        if (!Number.isNaN(m) && m >= 1 && m <= 12) {
          archiveMonth = m;
        }
      }
    }
  }

  const db = getDb();
  const { posts } = await listPosts(db, {
    status: "published",
    archiveYear,
    archiveMonth,
    page,
    pageSize: PAGE_SIZE + 1,
  });

  const hasMore = posts.length > PAGE_SIZE;
  const displayPosts = hasMore ? posts.slice(0, PAGE_SIZE) : posts;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: websiteJsonLd() }}
      />

      <section>
        {displayPosts.length === 0 ? (
          <p className="py-12 text-center text-blog-muted">
            {t(locale, "blog.home.noPosts")}
          </p>
        ) : (
          displayPosts.map((post, i) => (
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
        hasMore={hasMore}
        basePath="/"
        locale={locale}
        {...(params.archive ? { extraParams: { archive: params.archive } } : {})}
      />
    </>
  );
}
