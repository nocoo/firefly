import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCategoryBySlug } from "@/data/categories";
import { listPosts } from "@/data/posts";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { buildPageMeta } from "@/lib/seo";

const PAGE_SIZE = 20;

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = getDb();
  const category = await getCategoryBySlug(db, slug);

  if (!category) return { title: "Not Found" };

  return buildPageMeta({
    title: category.name,
    description: category.description ?? `Posts in ${category.name}`,
    path: `/category/${category.slug}`,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const db = getDb();
  const category = await getCategoryBySlug(db, slug);

  if (!category) notFound();

  const { posts } = await listPosts(db, {
    status: "published",
    categoryId: category.id,
    page,
    pageSize: PAGE_SIZE + 1,
  });

  const hasMore = posts.length > PAGE_SIZE;
  const displayPosts = hasMore ? posts.slice(0, PAGE_SIZE) : posts;

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <header className="mb-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {category.name}
        </h1>
        {category.description && (
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {category.description}
          </p>
        )}
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
          {category.post_count} post{category.post_count !== 1 ? "s" : ""}
        </p>
      </header>

      <section>
        {displayPosts.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 py-12 text-center">
            No posts in this category.
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
        basePath={`/category/${slug}`}
      />
    </main>
  );
}
