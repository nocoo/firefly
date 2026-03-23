import Link from "next/link";
import { getDb } from "@/lib/db";
import { listPosts } from "@/data/posts";
import { listCategories } from "@/data/categories";
import type { PostStatus } from "@/models/types";
import { formatDateDisplay } from "@/lib/seo";
import { PostFilters } from "@/components/admin/post-filters";
import { DeletePostButton } from "@/components/admin/delete-post-button";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";

interface AdminPostsPageProps {
  searchParams: Promise<{
    status?: string;
    category?: string;
    q?: string;
    page?: string;
  }>;
}

const STATUS_LABEL_KEYS: Record<PostStatus, string> = {
  draft: "admin.posts.status.draft",
  published: "admin.posts.status.published",
  private: "admin.posts.status.private",
  archived: "admin.posts.status.archived",
};

const STATUS_COLORS: Record<PostStatus, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  published: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  private: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  archived: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

export default async function AdminPostsPage({
  searchParams,
}: AdminPostsPageProps) {
  const params = await searchParams;
  const db = getDb();
  const locale = await getLocale();

  const status = params.status as PostStatus | undefined;
  const categoryId = params.category || undefined;
  const query = params.q || undefined;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = 20;

  const [result, categories] = await Promise.all([
    listPosts(db, { status, categoryId, query, page, pageSize }),
    listCategories(db),
  ]);

  const totalPages = Math.ceil(result.total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t(locale, "admin.posts.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t(locale, "admin.posts.total", { n: result.total })}
          </p>
        </div>
        <Link
          href="/admin/posts/new"
          className="inline-flex items-center gap-2 rounded-[var(--radius-widget)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t(locale, "admin.posts.new")}
        </Link>
      </div>

      {/* Filters */}
      <PostFilters categories={categories} />

      {/* Table */}
      <div className="overflow-x-auto rounded-[var(--radius-widget)] border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                {t(locale, "admin.posts.table.title")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                {t(locale, "admin.posts.table.status")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                {t(locale, "admin.posts.table.category")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                {t(locale, "admin.posts.table.date")}
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                {t(locale, "admin.posts.table.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {result.posts.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {t(locale, "admin.posts.noResults")}
                </td>
              </tr>
            ) : (
              result.posts.map((post) => (
                <tr
                  key={post.id}
                  className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/posts/${post.id}/edit`}
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {post.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[post.status as PostStatus] ?? ""}`}
                    >
                      {t(locale, STATUS_LABEL_KEYS[post.status as PostStatus] ?? post.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {post.category_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {post.published_at
                      ? formatDateDisplay(post.published_at)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/posts/${post.id}/edit`}
                        className="text-sm text-primary hover:text-primary/80 transition-colors"
                      >
                        {t(locale, "admin.posts.edit")}
                      </Link>
                      <DeletePostButton slug={post.slug} title={post.title} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t(locale, "admin.pagination.page", { page, total: totalPages })}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <PaginationLink page={page - 1} params={params} label={t(locale, "admin.pagination.previous")} />
            )}
            {page < totalPages && (
              <PaginationLink page={page + 1} params={params} label={t(locale, "admin.pagination.next")} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PaginationLink({
  page,
  params,
  label,
}: {
  page: number;
  params: Record<string, string | undefined>;
  label: string;
}) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.category) sp.set("category", params.category);
  if (params.q) sp.set("q", params.q);
  sp.set("page", String(page));

  return (
    <Link
      href={`/admin/posts?${sp.toString()}`}
      className="inline-flex items-center rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
    >
      {label}
    </Link>
  );
}
