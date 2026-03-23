import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getTagBySlug } from "@/data/tags";
import { listPosts } from "@/data/posts";
import { getSiteSettings } from "@/data/settings";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";

interface Props {
  params: Promise<{ slug: string; page: string }>;
}

export default async function TagPaged({ params }: Props) {
  const { slug, page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (Number.isNaN(page) || page < 2) notFound();

  const locale = await getLocale();

  const db = getDb();
  const tag = await getTagBySlug(db, slug);

  if (!tag) notFound();

  const { postsPerPage } = await getSiteSettings(db);
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
        currentPage={page}
        totalPages={totalPages}
        basePath={`/tag/${slug}`}
        locale={locale}
      />
    </>
  );
}
