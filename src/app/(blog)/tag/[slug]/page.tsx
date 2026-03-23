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
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-bold leading-tight text-blog-text md:text-3xl">
          #{tag.name}
        </h1>
        <p className="mt-1 text-xs text-blog-muted">
          {tag.post_count} post{tag.post_count !== 1 ? "s" : ""}
        </p>
      </header>

      <section>
        {displayPosts.length === 0 ? (
          <p className="py-12 text-center text-blog-muted">
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
    </>
  );
}
