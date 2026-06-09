import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCategoryBySlug } from "@/data/entities/category";
import { listPosts } from "@/data/entities/post";
import { getSiteSettings } from "@/data/settings";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { ListPageHeader } from "@/components/blog/list-page-header";
import { buildPageMeta, SITE_URL, postPath } from "@/lib/seo";
import { collectionPageJsonLd } from "@/lib/jsonld";
import { ListOriginTracker } from "@/components/blog/list-origin-tracker";
import { EmptyState } from "@/components/blog/empty-state";
import { Folder } from "lucide-react";
import { getPostAuthor } from "@/lib/ai-agent/author";

interface Props {
  params: Promise<{ slug: string; page: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (Number.isNaN(page) || page < 2) return { title: "Not Found" };

  const db = getDb();
  const category = await getCategoryBySlug(db, slug);
  if (!category) return { title: "Not Found" };

  const settings = await getSiteSettings(db);
  return buildPageMeta({
    title: `${category.name} – Page ${page}`,
    description: category.description || category.name,
    path: `/category/${slug}/page/${page}`,
  }, settings);
}

export default async function CategoryPaged({ params }: Props) {
  const { slug, page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (Number.isNaN(page) || page < 2) notFound();

  const db = getDb();
  const category = await getCategoryBySlug(db, slug);

  if (!category) notFound();

  const settings = await getSiteSettings(db);
  const { postsPerPage } = settings;
  const { posts, total } = await listPosts(db, {
    status: "published",
    categoryId: category.id,
    page,
    pageSize: postsPerPage,
  });

  const totalPages = Math.ceil(total / postsPerPage);
  if (page > totalPages) notFound();

  return (
    <>
      <ListOriginTracker />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: collectionPageJsonLd(
            `${category.name} – Page ${page}`,
            `/category/${slug}/page/${page}`,
            posts.map((p) => ({
              url: `${SITE_URL}${postPath(p.slug, p.published_at)}`,
              name: p.title,
            })),
          ),
        }}
      />

      <ListPageHeader
        title={category.name}
        description={
          <>
            {category.description && <span>{category.description}</span>}
            {category.description && <br />}
            <span>{`${category.post_count} 篇文章`}</span>
          </>
        }
      />

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
        currentPage={page}
        totalPages={totalPages}
        basePath={`/category/${slug}`}
      />
    </>
  );
}
