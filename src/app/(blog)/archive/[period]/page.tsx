import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { listPosts } from "@/data/posts";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";

export const PAGE_SIZE = 10;

interface ArchivePageProps {
  params: Promise<{ period: string }>;
}

/** Parse "2026-02" → { year: 2026, month: 2 } or "2024" → { year: 2024 } */
export function parseArchivePeriod(period: string): {
  year: number;
  month?: number;
} | null {
  const parts = period.split("-");
  const year = parseInt(parts[0], 10);
  if (Number.isNaN(year)) return null;

  if (parts.length >= 2) {
    const month = parseInt(parts[1], 10);
    if (!Number.isNaN(month) && month >= 1 && month <= 12) {
      return { year, month };
    }
  }
  return { year };
}

export default async function ArchivePage({ params }: ArchivePageProps) {
  const { period } = await params;
  const parsed = parseArchivePeriod(period);
  if (!parsed) notFound();

  const locale = await getLocale();
  const db = getDb();

  const { posts, total } = await listPosts(db, {
    status: "published",
    archiveYear: parsed.year,
    archiveMonth: parsed.month,
    page: 1,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-bold leading-tight text-blog-text md:text-3xl">
          {parsed.month
            ? `${parsed.year} ${t(locale, "blog.sidebar.yearSuffix")} ${parsed.month} ${t(locale, "blog.sidebar.monthSuffix")}`
            : `${parsed.year} ${t(locale, "blog.sidebar.yearSuffix")}`}
        </h1>
        <p className="mt-1 text-xs text-blog-muted">
          {t(locale, "blog.category.postCount", { n: total })}
        </p>
      </header>

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
        basePath={`/archive/${period}`}
        locale={locale}
      />
    </>
  );
}
