"use client";

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutList, LayoutGrid, Eye, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import type { PostWithCategory, PostStatus, Category, Tag } from "@/models/types";
import { postPath, formatDateDisplay } from "@/lib/seo";
import { PostFilters } from "@/components/admin/post-filters";
import { DeletePostButton } from "@/components/admin/delete-post-button";
import { PostGridCard } from "@/components/admin/post-grid-card";
import { Select } from "@/components/ui/select";
import { useLocale } from "@/i18n/context";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type ViewMode = "list" | "grid";
const VIEW_MODE_KEY = "firefly_posts_view_mode";
const GRID_PAGE_SIZE = 36;

// Subscribe to storage events so view mode stays in sync across tabs
function subscribeViewMode(callback: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === VIEW_MODE_KEY) callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

function getViewModeSnapshot(): ViewMode {
  const stored = localStorage.getItem(VIEW_MODE_KEY);
  return stored === "grid" ? "grid" : "list";
}

function getViewModeServerSnapshot(): ViewMode {
  return "list";
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

function getPreviewUrl(post: PostWithCategory): string {
  if (post.status === "published" && post.published_at) {
    return postPath(post.slug, post.published_at);
  }
  return `/preview/${post.id}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AdminPostsClientProps {
  /** Initial posts for list view (server-rendered first page) */
  posts: PostWithCategory[];
  total: number;
  categories: Category[];
  tags: Tag[];
  /** Current URL search params for pagination links */
  currentParams: Record<string, string | undefined>;
  currentPage: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminPostsClient({
  posts,
  total,
  categories,
  tags,
  currentParams,
  currentPage,
  pageSize,
}: AdminPostsClientProps) {
  const { t } = useLocale();
  const viewMode = useSyncExternalStore(
    subscribeViewMode,
    getViewModeSnapshot,
    getViewModeServerSnapshot,
  );

  const handleViewModeChange = (mode: ViewMode) => {
    localStorage.setItem(VIEW_MODE_KEY, mode);
    // Force re-render by dispatching a storage event (same-tab won't trigger natively)
    window.dispatchEvent(new StorageEvent("storage", { key: VIEW_MODE_KEY }));
  };

  const totalPages = Math.ceil(total / pageSize);

  // Selection state — lives at the top so it persists across view mode switches
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Clear selection when filters / page change
  useEffect(() => {
    setSelectedIds(new Set()); // eslint-disable-line react-hooks/set-state-in-effect
  }, [currentParams, currentPage]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t("admin.posts.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("admin.posts.total", { n: total })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
            <button
              onClick={() => handleViewModeChange("list")}
              aria-label={t("admin.posts.viewList")}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                viewMode === "list"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutList className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => handleViewModeChange("grid")}
              aria-label={t("admin.posts.viewGrid")}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                viewMode === "grid"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>

          <Link
            href="/admin/posts/new"
            className="inline-flex items-center gap-2 rounded-[var(--radius-widget)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("admin.posts.new")}
          </Link>
        </div>
      </div>

      {/* Filters */}
      <PostFilters categories={categories} tags={tags} />

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedIds={selectedIds}
          categories={categories}
          onClearSelection={clearSelection}
        />
      )}

      {/* View content */}
      {viewMode === "list" ? (
        <ListView
          posts={posts}
          total={total}
          totalPages={totalPages}
          currentPage={currentPage}
          currentParams={currentParams}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleAll={(allIds) => {
            setSelectedIds((prev) => {
              const allSelected = allIds.every((id) => prev.has(id));
              if (allSelected) return new Set();
              return new Set([...prev, ...allIds]);
            });
          }}
        />
      ) : (
        <GridView
          currentParams={currentParams}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk Action Bar
// ---------------------------------------------------------------------------

function BulkActionBar({
  selectedIds,
  categories,
  onClearSelection,
}: {
  selectedIds: Set<string>;
  categories: Category[];
  onClearSelection: () => void;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    const updates: Record<string, unknown> = {};
    if (bulkStatus) updates.status = bulkStatus;
    if (bulkCategory === "__none__") updates.category_id = null;
    else if (bulkCategory) updates.category_id = bulkCategory;

    if (Object.keys(updates).length === 0) return;

    setApplying(true);
    try {
      const res = await fetch("/api/admin/posts/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [...selectedIds],
          updates,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? t("admin.posts.bulk.failed"));
      }

      const data = await res.json();
      onClearSelection();
      setBulkStatus("");
      setBulkCategory("");
      router.refresh();

      if (data.changed > 0) {
        toast.success(t("admin.posts.bulk.success", { n: data.changed }));
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("admin.posts.bulk.failed"),
      );
    } finally {
      setApplying(false);
    }
  };

  const hasUpdates = bulkStatus !== "" || bulkCategory !== "";

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-[var(--radius-widget)] border border-primary/30 bg-primary/5 px-4 py-3 shadow-sm backdrop-blur-sm">
      {/* Selection count + dismiss */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {t("admin.posts.bulk.selected", { n: selectedIds.size })}
        </span>
        <button
          type="button"
          onClick={onClearSelection}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t("admin.posts.bulk.deselectAll")}
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="h-5 w-px bg-border" />

      {/* Bulk status */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-muted-foreground whitespace-nowrap">
          {t("admin.posts.bulk.setStatus")}
        </label>
        <Select
          value={bulkStatus}
          onChange={(e) => setBulkStatus(e.target.value)}
          className="w-auto !h-8 !py-1 text-xs"
        >
          <option value="">—</option>
          <option value="published">{t("admin.filters.published")}</option>
          <option value="draft">{t("admin.filters.draft")}</option>
          <option value="private">{t("admin.filters.private")}</option>
          <option value="archived">{t("admin.filters.archived")}</option>
        </Select>
      </div>

      {/* Bulk category */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-muted-foreground whitespace-nowrap">
          {t("admin.posts.bulk.setCategory")}
        </label>
        <Select
          value={bulkCategory}
          onChange={(e) => setBulkCategory(e.target.value)}
          className="w-auto !h-8 !py-1 text-xs"
        >
          <option value="">—</option>
          <option value="__none__">{t("admin.posts.bulk.noCategory")}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Apply button */}
      <button
        type="button"
        onClick={handleApply}
        disabled={applying || !hasUpdates}
        className="inline-flex items-center gap-1 rounded-[var(--radius-widget)] bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {applying
          ? t("admin.posts.bulk.applying")
          : t("admin.posts.bulk.apply")}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// List View
// ---------------------------------------------------------------------------

function ListView({
  posts,
  totalPages,
  currentPage,
  currentParams,
  selectedIds,
  onToggleSelect,
  onToggleAll,
}: {
  posts: PostWithCategory[];
  total: number;
  totalPages: number;
  currentPage: number;
  currentParams: Record<string, string | undefined>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: (allIds: string[]) => void;
}) {
  const { t } = useLocale();

  const allIds = posts.map((p) => p.id);
  const allSelected = posts.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = posts.length > 0 && allIds.some((id) => selectedIds.has(id));

  return (
    <>
      {/* Table */}
      <div className="overflow-x-auto rounded-[var(--radius-widget)] border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={() => onToggleAll(allIds)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-ring cursor-pointer"
                  aria-label={
                    allSelected
                      ? t("admin.posts.bulk.deselectAll")
                      : t("admin.posts.bulk.selectAll")
                  }
                />
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                {t("admin.posts.table.title")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                {t("admin.posts.table.status")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                {t("admin.posts.table.category")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                {t("admin.posts.table.date")}
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                {t("admin.posts.table.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {t("admin.posts.noResults")}
                </td>
              </tr>
            ) : (
              posts.map((post) => {
                const isSelected = selectedIds.has(post.id);
                return (
                  <tr
                    key={post.id}
                    className={`border-b border-border last:border-0 transition-colors ${
                      isSelected
                        ? "bg-primary/5"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    <td className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(post.id)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-ring cursor-pointer"
                      />
                    </td>
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
                        {t(STATUS_LABEL_KEYS[post.status as PostStatus] ?? post.status)}
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
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={getPreviewUrl(post)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-[var(--radius-widget)] px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                          {t("admin.posts.preview")}
                        </a>
                        <Link
                          href={`/admin/posts/${post.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-[var(--radius-widget)] px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                          {t("admin.posts.edit")}
                        </Link>
                        <DeletePostButton slug={post.slug} title={post.title} />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Full pagination */}
      {totalPages > 1 && (
        <Pagination
          totalPages={totalPages}
          currentPage={currentPage}
          currentParams={currentParams}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Pagination — full page numbers
// ---------------------------------------------------------------------------

function Pagination({
  totalPages,
  currentPage,
  currentParams,
}: {
  totalPages: number;
  currentPage: number;
  currentParams: Record<string, string | undefined>;
}) {
  const { t } = useLocale();

  const buildHref = (page: number) => {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(currentParams)) {
      if (value) sp.set(key, value);
    }
    if (page > 1) sp.set("page", String(page));
    else sp.delete("page");
    const qs = sp.toString();
    return `/admin/posts${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {t("admin.pagination.page", { page: currentPage, total: totalPages })}
      </p>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <Link
            key={page}
            href={buildHref(page)}
            className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-[var(--radius-widget)] border px-2 text-sm transition-colors ${
              page === currentPage
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-secondary text-foreground hover:bg-accent"
            }`}
          >
            {page}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grid View — infinite scroll
// ---------------------------------------------------------------------------

function GridView({
  currentParams,
  selectedIds,
  onToggleSelect,
}: {
  currentParams: Record<string, string | undefined>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  const { t } = useLocale();
  const [posts, setPosts] = useState<PostWithCategory[]>([]);
  const [_page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const fetchPosts = useCallback(
    async (pageNum: number) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);

      try {
        const sp = new URLSearchParams();
        sp.set("page", String(pageNum));
        sp.set("pageSize", String(GRID_PAGE_SIZE));
        if (currentParams.status) sp.set("status", currentParams.status);
        if (currentParams.category) sp.set("category", currentParams.category);
        if (currentParams.tag) sp.set("tag", currentParams.tag);
        if (currentParams.q) sp.set("q", currentParams.q);
        if (currentParams.year) sp.set("year", currentParams.year);
        if (currentParams.month) sp.set("month", currentParams.month);

        const res = await fetch(`/api/admin/posts?${sp.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch posts");

        const data = (await res.json()) as {
          posts: PostWithCategory[];
          total: number;
        };

        setPosts((prev) =>
          pageNum === 1 ? data.posts : [...prev, ...data.posts],
        );
        setHasMore(pageNum * GRID_PAGE_SIZE < data.total);
      } catch (err) {
        console.error("Failed to load posts:", err);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [currentParams.status, currentParams.category, currentParams.tag, currentParams.q, currentParams.year, currentParams.month],
  );

  // Reset when filters change
  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
    fetchPosts(1);
  }, [fetchPosts]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          setPage((prev) => {
            const next = prev + 1;
            fetchPosts(next);
            return next;
          });
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, fetchPosts]);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {posts.map((post) => (
          <PostGridCard
            key={post.id}
            post={post}
            selected={selectedIds.has(post.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-1" />

      {loading && (
        <div className="py-4 text-center text-sm text-muted-foreground">
          {t("admin.posts.loadingMore")}
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <div className="py-4 text-center text-sm text-muted-foreground">
          {t("admin.posts.noMorePosts")}
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          {t("admin.posts.noResults")}
        </div>
      )}
    </>
  );
}
