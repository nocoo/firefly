import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { searchPosts } from "@/data/entities/post";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";
import { EmptyState } from "@/components/blog/empty-state";
import { Search } from "lucide-react";

export const metadata: Metadata = {
  robots: { index: false },
};

const PAGE_SIZE = 10;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const locale = await getLocale();

  if (!q?.trim()) {
    return (
      <div className="blog-search-results">
        <EmptyState icon={Search} message={t(locale, "blog.search.prompt")} />
      </div>
    );
  }

  const db = getDb();
  const currentPage = page ? parseInt(page, 10) : 1;

  const result = await searchPosts(db, {
    query: q.trim(),
    page: currentPage,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.ceil(result.total / PAGE_SIZE);

  return (
    <div className="blog-search-results">
      <h1>
        {t(locale, "blog.search.resultsTitle", {
          query: q,
          total: String(result.total),
        })}
      </h1>

      {result.posts.length === 0 ? (
        <EmptyState
          icon={Search}
          message={t(locale, "blog.search.noResults")}
        />
      ) : (
        <>
          <section>
            {result.posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                locale={locale}
                snippet={result.snippets[post.id]}
              />
            ))}
          </section>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            basePath="/search"
            locale={locale}
            searchParams={{ q }}
          />
        </>
      )}
    </div>
  );
}
