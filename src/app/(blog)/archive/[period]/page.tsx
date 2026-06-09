import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { listPosts, listMonthlyArchives } from "@/data/entities/post";
import { getSiteSettings } from "@/data/settings";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { ListPageHeader } from "@/components/blog/list-page-header";
import { ArchiveHeatmap } from "@/components/blog/archive-heatmap";
import { buildPageMeta, SITE_URL, postPath } from "@/lib/seo";
import { collectionPageJsonLd } from "@/lib/jsonld";
import { ListOriginTracker } from "@/components/blog/list-origin-tracker";
import { EmptyState } from "@/components/blog/empty-state";
import { parseArchivePeriod } from "./parse-archive-period";
import { Archive } from "lucide-react";
import { getPostAuthor } from "@/lib/ai-agent/author";

interface ArchivePageProps {
  params: Promise<{ period: string }>;
}


export async function generateMetadata({ params }: ArchivePageProps): Promise<Metadata> {
  const { period } = await params;
  const parsed = parseArchivePeriod(period);
  if (!parsed) return { title: "Not Found" };

  const db = getDb();
  const settings = await getSiteSettings(db);
  const label = parsed.month
    ? `${parsed.year} 年 ${parsed.month} 月`
    : `${parsed.year} 年`;

  return buildPageMeta({
    title: label,
    description: label,
    path: `/archive/${period}`,
  }, settings);
}

export default async function ArchivePage({ params }: ArchivePageProps) {
  const { period } = await params;
  const parsed = parseArchivePeriod(period);
  if (!parsed) notFound();

  const db = getDb();

  const settings = await getSiteSettings(db);
  const { postsPerPage } = settings;
  const [{ posts, total }, archives] = await Promise.all([
    listPosts(db, {
      status: "published",
      archiveYear: parsed.year,
      archiveMonth: parsed.month,
      page: 1,
      pageSize: postsPerPage,
    }),
    parsed.month ? Promise.resolve([]) : listMonthlyArchives(db),
  ]);

  const totalPages = Math.ceil(total / postsPerPage);

  const label = parsed.month
    ? `${parsed.year} 年 ${parsed.month} 月`
    : `${parsed.year} 年`;

  return (
    <>
      <ListOriginTracker />
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
          ),
        }}
      />

      <ListPageHeader title={label} description={`${total} 篇文章`} />

      {/* Year-page heatmap: shows the full year breakdown so readers can
       *  jump to a specific month without flipping pages. */}
      {!parsed.month && archives.length > 0 && (
        <ArchiveHeatmap archives={archives} year={parsed.year} />
      )}

      <section>
        {posts.length === 0 ? (
          <EmptyState
            icon={Archive}
            message="该时期暂无文章。"
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
        basePath={`/archive/${period}`}
      />
    </>
  );
}
