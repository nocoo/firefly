import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getTagBySlug } from "@/data/entities/tag";
import { listPosts } from "@/data/posts";
import { getSiteSettings } from "@/data/settings";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { buildPageMeta, SITE_URL, postPath } from "@/lib/seo";
import { collectionPageJsonLd } from "@/lib/jsonld";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";
import { ListOriginTracker } from "@/components/blog/list-origin-tracker";

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

  const [settings, locale] = await Promise.all([
    getSiteSettings(db),
    getLocale(),
  ]);
  return buildPageMeta({
    title: `#${tag.name} – Page ${page}`,
    description: `#${tag.name}`,
    path: `/tag/${slug}/page/${page}`,
    locale,
  }, settings);
}

export default async function TagPaged({ params }: Props) {
  const { slug, page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (Number.isNaN(page) || page < 2) notFound();

  const locale = await getLocale();

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
            locale,
          ),
        }}
      />

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
              author={settings.siteAuthor}
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
