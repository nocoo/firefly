import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { listPosts } from "@/data/posts";
import { getSiteSettings } from "@/data/settings";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { buildPageMeta, SITE_URL, postPath } from "@/lib/seo";
import { collectionPageJsonLd } from "@/lib/jsonld";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";

interface ArchivePageProps {
  params: Promise<{ period: string }>;
}

/** Parse "2026-02" → { year: 2026, month: 2 } or "2024" → { year: 2024 } */
export function parseArchivePeriod(period: string): {
  year: number;
  month?: number;
} | null {
  const parts = period.split("-");
  if (parts.length > 2) return null;

  const year = parseInt(parts[0], 10);
  if (Number.isNaN(year) || year < 1970 || year > 9999) return null;

  if (parts.length === 2) {
    const month = parseInt(parts[1], 10);
    if (Number.isNaN(month) || month < 1 || month > 12) return null;
    return { year, month };
  }
  return { year };
}

export async function generateMetadata({ params }: ArchivePageProps): Promise<Metadata> {
  const { period } = await params;
  const parsed = parseArchivePeriod(period);
  if (!parsed) return { title: "Not Found" };

  const db = getDb();
  const [settings, locale] = await Promise.all([
    getSiteSettings(db),
    getLocale(),
  ]);
  const label = parsed.month
    ? `${parsed.year} ${t(locale, "blog.sidebar.yearSuffix")} ${parsed.month} ${t(locale, "blog.sidebar.monthSuffix")}`
    : `${parsed.year} ${t(locale, "blog.sidebar.yearSuffix")}`;

  return buildPageMeta({
    title: label,
    description: label,
    path: `/archive/${period}`,
    locale,
  }, settings);
}

export default async function ArchivePage({ params }: ArchivePageProps) {
  const { period } = await params;
  const parsed = parseArchivePeriod(period);
  if (!parsed) notFound();

  const locale = await getLocale();
  const db = getDb();

  const settings = await getSiteSettings(db);
  const { postsPerPage } = settings;
  const { posts, total } = await listPosts(db, {
    status: "published",
    archiveYear: parsed.year,
    archiveMonth: parsed.month,
    page: 1,
    pageSize: postsPerPage,
  });

  const totalPages = Math.ceil(total / postsPerPage);

  const label = parsed.month
    ? `${parsed.year} ${t(locale, "blog.sidebar.yearSuffix")} ${parsed.month} ${t(locale, "blog.sidebar.monthSuffix")}`
    : `${parsed.year} ${t(locale, "blog.sidebar.yearSuffix")}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: collectionPageJsonLd(
            label,
            `/archive/${period}`,
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
          {label}
        </h1>
        <p className="mt-1 text-xs text-blog-muted">
          {t(locale, "blog.category.postCount", { n: total })}
        </p>
      </header>

      <section>
        {posts.length === 0 ? (
          <p className="py-12 text-center text-blog-muted">
            {t(locale, "blog.home.noPosts")}
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
        currentPage={1}
        totalPages={totalPages}
        basePath={`/archive/${period}`}
        locale={locale}
      />
    </>
  );
}
