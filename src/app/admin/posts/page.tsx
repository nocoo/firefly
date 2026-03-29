import { getDb } from "@/lib/db";
import { listPosts, listPostYears } from "@/data/entities/post";
import { listCategories } from "@/data/entities/category";
import { listTags } from "@/data/entities/tag";
import type { PostStatus } from "@/models/types";
import { AdminPostsClient } from "@/components/admin/admin-posts-client";

interface AdminPostsPageProps {
  searchParams: Promise<{
    status?: string;
    category?: string;
    tag?: string;
    q?: string;
    page?: string;
    year?: string;
    month?: string;
    sort_by?: string;
    sort_order?: string;
  }>;
}

const PAGE_SIZE = 30;

export default async function AdminPostsPage({
  searchParams,
}: AdminPostsPageProps) {
  const params = await searchParams;
  const db = getDb();

  const status = params.status as PostStatus | undefined;
  const categoryId = params.category || undefined;
  const tagId = params.tag || undefined;
  const query = params.q || undefined;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const archiveYear = params.year ? parseInt(params.year, 10) || undefined : undefined;
  const archiveMonth = params.month ? parseInt(params.month, 10) || undefined : undefined;

  const VALID_SORT_BY = ["published_at", "created_at", "comment_count", "view_count", "title"] as const;
  const sortBy = VALID_SORT_BY.includes(params.sort_by as (typeof VALID_SORT_BY)[number])
    ? (params.sort_by as (typeof VALID_SORT_BY)[number])
    : "created_at";
  const sortOrder = params.sort_order === "asc" ? "asc" as const : "desc" as const;

  const [result, categories, tags, yearCounts] = await Promise.all([
    listPosts(db, { status, categoryId, tagId, query, archiveYear, archiveMonth, page, pageSize: PAGE_SIZE, sortBy, sortOrder }),
    listCategories(db),
    listTags(db),
    listPostYears(db),
  ]);

  return (
    <AdminPostsClient
      posts={result.posts}
      total={result.total}
      categories={categories}
      tags={tags}
      yearCounts={yearCounts}
      currentParams={{
        status: params.status,
        category: params.category,
        tag: params.tag,
        q: params.q,
        year: params.year,
        month: params.month,
        sort_by: params.sort_by,
        sort_order: params.sort_order,
      }}
      currentPage={page}
      pageSize={PAGE_SIZE}
      currentSortBy={sortBy}
      currentSortOrder={sortOrder}
    />
  );
}
