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
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";
import { ListOriginTracker } from "@/components/blog/list-origin-tracker";
import { Folder } from "lucide-react";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = getDb();
  const category = await getCategoryBySlug(db, slug);
  const locale = await getLocale();

  if (!category) return { title: "Not Found" };

  const settings = await getSiteSettings(db);
  return buildPageMeta({
    title: category.name,
    description: category.description ?? t(locale, "blog.category.metaDescription", { name: category.name }),
    path: `/category/${category.slug}`,
    locale,
  }, settings);
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const locale = await getLocale();

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
            locale,
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
          {t(locale, "blog.category.postCount", { n: category.post_count })}
        </p>
      </header>

      <section>
        {posts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-blog-muted">
            <Folder className="h-8 w-8 opacity-40" strokeWidth={1.5} />
            <p className="text-sm">{t(locale, "blog.category.noPosts")}</p>
          </div>
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
        currentPage={1}
        totalPages={totalPages}
        basePath={`/category/${slug}`}
        locale={locale}
      />
    </>
  );
}
