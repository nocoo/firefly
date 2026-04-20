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

interface Props {
  params: Promise<{ slug: string; page: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (Number.isNaN(page) || page < 2) return { title: "Not Found" };

  const db = getDb();
  const tag = await getTagBySlug(db, slug);
  if (!tag) return { title: "Not Found" };

  const settings = await getSiteSettings(db);
  return buildPageMeta({
    title: `#${tag.name} – Page ${page}`,
    description: `#${tag.name}`,
    path: `/tag/${slug}/page/${page}`,
  }, settings);
}

export default async function TagPaged({ params }: Props) {
  const { slug, page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (Number.isNaN(page) || page < 2) notFound();

  const db = getDb();
  const tag = await getTagBySlug(db, slug);

  if (!tag) notFound();

  const settings = await getSiteSettings(db);
  const { postsPerPage } = settings;
  const { posts, total } = await listPosts(db, {
    status: "published",
    tagId: tag.id,
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
            `#${tag.name} – Page ${page}`,
            `/tag/${slug}/page/${page}`,
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
        currentPage={page}
        totalPages={totalPages}
        basePath={`/tag/${slug}`}
      />
    </>
  );
}
