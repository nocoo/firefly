import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getTagBySlug } from "@/data/tags";
import { listPosts } from "@/data/posts";
import { getSiteSettings } from "@/data/settings";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { buildPageMeta } from "@/lib/seo";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";

interface TagPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: TagPageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = getDb();
  const tag = await getTagBySlug(db, slug);
  const locale = await getLocale();

  if (!tag) return { title: "Not Found" };

  return buildPageMeta({
    title: `#${tag.name}`,
    description: t(locale, "blog.tag.metaDescription", { name: tag.name }),
    path: `/tag/${tag.slug}`,
    locale,
  });
}

export default async function TagPage({ params }: TagPageProps) {
  const { slug } = await params;
  const locale = await getLocale();

  const db = getDb();
  const tag = await getTagBySlug(db, slug);

  if (!tag) notFound();

  const { postsPerPage } = await getSiteSettings(db);
  const { posts, total } = await listPosts(db, {
    status: "published",
    tagId: tag.id,
    page: 1,
    pageSize: postsPerPage,
  });

  const totalPages = Math.ceil(total / postsPerPage);

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-bold leading-tight text-blog-text md:text-3xl">
          #{tag.name}
        </h1>
        <p className="mt-1 text-xs text-blog-muted">
          {t(locale, "blog.category.postCount", { n: tag.post_count })}
        </p>
      </header>

      <section>
        {posts.length === 0 ? (
          <p className="py-12 text-center text-blog-muted">
            {t(locale, "blog.tag.noPosts")}
          </p>
        ) : (
          posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              locale={locale}
              priority={i === 0 && !!post.featured_image}
            />
          ))
        )}
      </section>

      <Pagination
        currentPage={1}
        totalPages={totalPages}
        basePath={`/tag/${slug}`}
        locale={locale}
      />
    </>
  );
}
