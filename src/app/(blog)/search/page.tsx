import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { searchPosts } from "@/data/entities/post";
import { getSiteSettings } from "@/data/settings";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { EmptyState } from "@/components/blog/empty-state";
import { Search } from "lucide-react";
import { getPostAuthor } from "@/lib/ai-agent/author";

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

  if (!q?.trim()) {
    return (
      <div className="blog-search-results">
        <EmptyState icon={Search} message="输入关键词搜索文章。" />
      </div>
    );
  }

  const db = getDb();
  const parsed = page ? parseInt(page, 10) : 1;
  const currentPage = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;

  const [result, settings] = await Promise.all([
    searchPosts(db, {
      query: q.trim(),
      page: currentPage,
      pageSize: PAGE_SIZE,
    }),
    getSiteSettings(db),
  ]);

  const totalPages = Math.ceil(result.total / PAGE_SIZE);

  return (
    <div className="blog-search-results">
      <h1>
        {`搜索 "${q}" 共 ${result.total} 条结果`}
      </h1>

      {result.posts.length === 0 ? (
        <EmptyState
          icon={Search}
          message="未找到相关结果，请尝试其他关键词。"
        />
      ) : (
        <>
          <section>
            {result.posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                author={getPostAuthor(post, settings)}
                snippet={result.snippets[post.id]}
              />
            ))}
          </section>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            basePath="/search"
            searchParams={{ q }}
          />
        </>
      )}
    </div>
  );
}
