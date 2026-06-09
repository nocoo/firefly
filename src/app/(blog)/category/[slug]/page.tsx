import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCategoryBySlug } from "@/data/entities/category";
import { listPosts } from "@/data/entities/post";
import { getSiteSettings } from "@/data/settings";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { buildPageMeta, SITE_URL, postPath } from "@/lib/seo";
import { collectionPageJsonLd } from "@/lib/jsonld";
import { ListOriginTracker } from "@/components/blog/list-origin-tracker";
import { EmptyState } from "@/components/blog/empty-state";
import { Folder } from "lucide-react";
import { getPostAuthor } from "@/lib/ai-agent/author";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = getDb();
  const category = await getCategoryBySlug(db, slug);

  if (!category) return { title: "Not Found" };

  const settings = await getSiteSettings(db);
  return buildPageMeta({
    title: category.name,
    description: category.description ?? `${category.name}分类下的文章`,
    path: `/category/${category.slug}`,
  }, settings);
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;

  const db = getDb();
  const category = await getCategoryBySlug(db, slug);

  if (!category) notFound();

  const settings = await getSiteSettings(db);
  const { postsPerPage } = settings;
  const { posts, total } = await listPosts(db, {
    status: "published",
    categoryId: category.id,
    page: 1,
    pageSize: postsPerPage,
  });

  const totalPages = Math.ceil(total / postsPerPage);

  return (
    <>
      <ListOriginTracker />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: collectionPageJsonLd(
            category.name,
            `/category/${slug}`,
            posts.map((p) => ({
              url: `${SITE_URL}${postPath(p.slug, p.published_at)}`,
              name: p.title,
            })),
          ),
        }}
      />

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
          {`${category.post_count} 篇文章`}
        </p>
      </header>

      <section>
        {posts.length === 0 ? (
          <EmptyState
            icon={Folder}
            message="该分类下暂无文章。"
            action={{ label: "返回首页", href: "/" }}
          />
        ) : (
          posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              author={getPostAuthor(post, settings)}
              priority={i === 0 && !!post.featured_image}
            />
          ))
        )}
      </section>

      <Pagination
        currentPage={1}
        totalPages={totalPages}
        basePath={`/category/${slug}`}
      />
    </>
  );
}
