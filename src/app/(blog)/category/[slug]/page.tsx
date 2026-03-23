import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCategoryBySlug } from "@/data/categories";
import { listPosts } from "@/data/posts";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { buildPageMeta } from "@/lib/seo";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";

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
  const locale = await getLocale();

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
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-bold leading-tight text-blog-text md:text-3xl">
          {category.name}
        </h1>
        {category.description && (
          <p className="mt-2 text-sm text-blog-muted">
            {category.description}
          </p>
        )}
        <p className="mt-1 text-xs text-blog-muted">
          {t(locale, "blog.category.postCount", { n: category.post_count })}
        </p>
      </header>

      <section>
        {displayPosts.length === 0 ? (
          <p className="py-12 text-center text-blog-muted">
            {t(locale, "blog.category.noPosts")}
          </p>
        ) : (
          displayPosts.map((post) => (
            <PostCard key={post.id} post={post} locale={locale} />
          ))
        )}
      </section>

      <Pagination
        currentPage={page}
        hasMore={hasMore}
        basePath={`/category/${slug}`}
        locale={locale}
      />
    </>
  );
}
