import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { listPosts } from "@/data/posts";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";
import { PAGE_SIZE, parseArchivePeriod } from "../../page";

interface Props {
  params: Promise<{ period: string; page: string }>;
}

export default async function ArchivePaged({ params }: Props) {
  const { period, page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (Number.isNaN(page) || page < 2) notFound();

  const parsed = parseArchivePeriod(period);
  if (!parsed) notFound();

  const locale = await getLocale();
  const db = getDb();

  const { posts, total } = await listPosts(db, {
    status: "published",
    archiveYear: parsed.year,
    archiveMonth: parsed.month,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (page > totalPages) notFound();

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
        currentPage={page}
        totalPages={totalPages}
        basePath={`/archive/${period}`}
        locale={locale}
      />
    </>
  );
}
