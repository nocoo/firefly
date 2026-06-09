import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { listMonthlyArchives } from "@/data/entities/post";
import { getSiteSettings } from "@/data/settings";
import { ListPageHeader } from "@/components/blog/list-page-header";
import { ArchiveHeatmap } from "@/components/blog/archive-heatmap";
import { EmptyState } from "@/components/blog/empty-state";
import { buildPageMeta } from "@/lib/seo";
import { Archive } from "lucide-react";

/**
 * /archive — overview page showing every year × month with publish counts as
 * a heatmap. Each cell links to its month's archive listing; year labels
 * link to the year archive. Acts as a single entry point for browsing the
 * full publishing history without scanning page-by-page.
 */

export async function generateMetadata(): Promise<Metadata> {
  const db = getDb();
  const settings = await getSiteSettings(db);
  return buildPageMeta(
    {
      title: "归档",
      description: "按月查看所有已发布文章。",
      path: "/archive",
    },
    settings,
  );
}

export default async function ArchiveIndexPage() {
  const db = getDb();
  const archives = await listMonthlyArchives(db);
  const total = archives.reduce((s, a) => s + a.count, 0);

  return (
    <>
      <ListPageHeader title="归档" description={`共 ${total} 篇文章`} />

      {archives.length === 0 ? (
        <EmptyState
          icon={Archive}
          message="尚未发布任何文章。"
          action={{ label: "返回首页", href: "/" }}
        />
      ) : (
        <ArchiveHeatmap archives={archives} />
      )}
    </>
  );
}
