import { getDb } from "@/lib/db";
import { listPosts } from "@/data/posts";
import { listCategories } from "@/data/categories";
import type { PostStatus } from "@/models/types";
import { AdminPostsClient } from "@/components/admin/admin-posts-client";

interface AdminPostsPageProps {
  searchParams: Promise<{
    status?: string;
    category?: string;
    q?: string;
    page?: string;
    year?: string;
    month?: string;
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
  const query = params.q || undefined;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const archiveYear = params.year ? parseInt(params.year, 10) || undefined : undefined;
  const archiveMonth = params.month ? parseInt(params.month, 10) || undefined : undefined;

  const [result, categories] = await Promise.all([
    listPosts(db, { status, categoryId, query, archiveYear, archiveMonth, page, pageSize: PAGE_SIZE }),
    listCategories(db),
  ]);

  return (
    <AdminPostsClient
      posts={result.posts}
      total={result.total}
      categories={categories}
      currentParams={{
        status: params.status,
        category: params.category,
        q: params.q,
        year: params.year,
        month: params.month,
      }}
      currentPage={page}
      pageSize={PAGE_SIZE}
    />
  );
}
