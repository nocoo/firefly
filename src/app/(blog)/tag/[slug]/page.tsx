import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getTagBySlug } from "@/data/entities/tag";
import { listPosts } from "@/data/entities/post";
import { getSiteSettings } from "@/data/settings";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { buildPageMeta, SITE_URL, postPath } from "@/lib/seo";
import { collectionPageJsonLd } from "@/lib/jsonld";
import { ListOriginTracker } from "@/components/blog/list-origin-tracker";
import { EmptyState } from "@/components/blog/empty-state";
import { Tag } from "lucide-react";
import { getPostAuthor } from "@/lib/ai-agent/author";

interface TagPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: TagPageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = getDb();
  const tag = await getTagBySlug(db, slug);

  if (!tag) return { title: "Not Found" };

  const settings = await getSiteSettings(db);
  const meta = buildPageMeta({
    title: `#${tag.name}`,
    description: `标签为 ${tag.name} 的文章`,
    path: `/tag/${tag.slug}`,
  }, settings);

  // Thin-content tags: noindex to avoid low-quality pages in search index
  if (tag.post_count < 3) {
    return { ...meta, robots: { index: false, follow: true } };
  }

  return meta;
}

export default async function TagPage({ params }: TagPageProps) {
  const { slug } = await params;

  const db = getDb();
  const tag = await getTagBySlug(db, slug);

  if (!tag) notFound();

  const settings = await getSiteSettings(db);
  const { postsPerPage } = settings;
  const { posts, total } = await listPosts(db, {
    status: "published",
    tagId: tag.id,
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
            `#${tag.name}`,
            `/tag/${slug}`,
            posts.map((p) => ({
              url: `${SITE_URL}${postPath(p.slug, p.published_at)}`,
              name: p.title,
            })),
          ),
        }}
      />

      <header className="mb-8">
        <h1 className="text-2xl font-bold leading-tight text-blog-text md:text-3xl">
          #{tag.name}
        </h1>
        <p className="mt-1 text-xs text-blog-muted">
          {`${tag.post_count} 篇文章`}
        </p>
      </header>

      <section>
        {posts.length === 0 ? (
          <EmptyState icon={Tag} message="该标签下暂无文章。" />
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
        basePath={`/tag/${slug}`}
      />
    </>
  );
}
