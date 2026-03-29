import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { listPosts } from "@/data/entities/post";
import { getSiteSettings } from "@/data/settings";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { buildPageMeta, SITE_URL, postPath } from "@/lib/seo";
import { collectionPageJsonLd } from "@/lib/jsonld";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";
import { ListOriginTracker } from "@/components/blog/list-origin-tracker";
import { EmptyState } from "@/components/blog/empty-state";
import { parseArchivePeriod } from "../../parse-archive-period";
import { Archive } from "lucide-react";

interface Props {
  params: Promise<{ period: string; page: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { period, page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (Number.isNaN(page) || page < 2) return { title: "Not Found" };

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
    title: `${label} – Page ${page}`,
    description: label,
    path: `/archive/${period}/page/${page}`,
    locale,
  }, settings);
}

export default async function ArchivePaged({ params }: Props) {
  const { period, page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (Number.isNaN(page) || page < 2) notFound();

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
    page,
    pageSize: postsPerPage,
  });

  const totalPages = Math.ceil(total / postsPerPage);
  if (page > totalPages) notFound();

  const label = parsed.month
    ? `${parsed.year} ${t(locale, "blog.sidebar.yearSuffix")} ${parsed.month} ${t(locale, "blog.sidebar.monthSuffix")}`
    : `${parsed.year} ${t(locale, "blog.sidebar.yearSuffix")}`;

  return (
    <>
      <ListOriginTracker />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: collectionPageJsonLd(
            `${label} – Page ${page}`,
            `/archive/${period}/page/${page}`,
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
          <EmptyState icon={Archive} message={t(locale, "blog.archive.noPosts")} />
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
        basePath={`/archive/${period}`}
        locale={locale}
      />
    </>
  );
}
