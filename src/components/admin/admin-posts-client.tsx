"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { LayoutList, LayoutGrid } from "lucide-react";
import type { PostWithCategory, Category, Tag } from "@/models/types";
import type { PostYearCount } from "@/data/entities/post";
import { PostFilters } from "@/components/admin/post-filters";
import { useSetPageSubtitle } from "@/components/admin/page-subtitle-context";
import { AdminPostsBulkActionBar } from "@/components/admin/admin-posts-bulk-action-bar";
import { AdminPostsListView } from "@/components/admin/admin-posts-list-view";
import { AdminPostsGridView } from "@/components/admin/admin-posts-grid-view";

// ---------------------------------------------------------------------------
// View-mode external store — keeps preference in localStorage across tabs
// ---------------------------------------------------------------------------

type ViewMode = "list" | "grid";
const VIEW_MODE_KEY = "firefly_posts_view_mode";

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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PostWithTags extends PostWithCategory {
  tags: { id: string; name: string; slug: string }[];
}

interface AdminPostsClientProps {
  /** Initial posts for list view (server-rendered first page) */
  posts: PostWithTags[];
  total: number;
  categories: Category[];
  tags: Tag[];
  /** Year counts for dynamic year filter */
  yearCounts: PostYearCount[];
  /** Current URL search params for pagination links */
  currentParams: Record<string, string | undefined>;
  currentPage: number;
  pageSize: number;
  currentSortBy: string;
  currentSortOrder: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
      <button
        onClick={() => onChange("list")}
        aria-label="列表视图"
        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
          viewMode === "list"
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <LayoutList className="h-4 w-4" strokeWidth={1.5} />
      </button>
      <button
        onClick={() => onChange("grid")}
        aria-label="网格视图"
        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
          viewMode === "grid"
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <LayoutGrid className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}

export function AdminPostsClient({
  posts,
  total,
  categories,
  tags,
  yearCounts,
  currentParams,
  currentPage,
  pageSize,
  currentSortBy,
  currentSortOrder,
}: AdminPostsClientProps) {
  const viewMode = useSyncExternalStore(
    subscribeViewMode,
    getViewModeSnapshot,
    getViewModeServerSnapshot,
  );

  useSetPageSubtitle(`共 ${total} 篇文章`);

  const handleViewModeChange = (mode: ViewMode) => {
    localStorage.setItem(VIEW_MODE_KEY, mode);
    window.dispatchEvent(new StorageEvent("storage", { key: VIEW_MODE_KEY }));
  };

  const totalPages = Math.ceil(total / pageSize);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedIds(new Set());
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

  const handleToggleAll = useCallback((allIds: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = allIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set([...prev, ...allIds]);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <PostFilters categories={categories} tags={tags} yearCounts={yearCounts} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ViewModeToggle viewMode={viewMode} onChange={handleViewModeChange} />
          <Link
            href="/admin/posts/new"
            className="inline-flex items-center gap-2 rounded-widget bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            新建文章
          </Link>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <AdminPostsBulkActionBar
          selectedIds={selectedIds}
          categories={categories}
          onClearSelection={clearSelection}
        />
      )}

      {viewMode === "list" ? (
        <AdminPostsListView
          posts={posts}
          total={total}
          totalPages={totalPages}
          currentPage={currentPage}
          currentParams={currentParams}
          currentSortBy={currentSortBy}
          currentSortOrder={currentSortOrder}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleAll={handleToggleAll}
        />
      ) : (
        <AdminPostsGridView
          currentParams={currentParams}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      )}
    </div>
  );
}
