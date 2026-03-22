import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getTagBySlug } from "@/data/tags";
import { listPosts } from "@/data/posts";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { buildPageMeta } from "@/lib/seo";

const PAGE_SIZE = 20;

interface TagPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({
  params,
}: TagPageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = getDb();
  const tag = await getTagBySlug(db, slug);

  if (!tag) return { title: "Not Found" };

  return buildPageMeta({
    title: `#${tag.name}`,
    description: `Posts tagged with ${tag.name}`,
    path: `/tag/${tag.slug}`,
  });
}

export default async function TagPage({
  params,
  searchParams,
}: TagPageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const db = getDb();
  const tag = await getTagBySlug(db, slug);

  if (!tag) notFound();

  const { posts } = await listPosts(db, {
    status: "published",
    tagId: tag.id,
    page,
    pageSize: PAGE_SIZE + 1,
  });

  const hasMore = posts.length > PAGE_SIZE;
  const displayPosts = hasMore ? posts.slice(0, PAGE_SIZE) : posts;

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <header className="mb-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          #{tag.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
          {tag.post_count} post{tag.post_count !== 1 ? "s" : ""}
        </p>
      </header>

      <section>
        {displayPosts.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 py-12 text-center">
            No posts with this tag.
          </p>
        ) : (
          displayPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))
        )}
      </section>

      <Pagination
        currentPage={page}
        hasMore={hasMore}
        basePath={`/tag/${slug}`}
      />
    </main>
  );
}
