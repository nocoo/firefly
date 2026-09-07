"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { LayoutList, LayoutGrid } from "lucide-react";
import type { PostWithCategory, Category, Tag } from "@/models/types";
import type { PostYearCount } from "@/data/entities/post";
import { PostFilters } from "@/components/admin/post-filters";
import { AdminPostsBulkActionBar } from "@/components/admin/admin-posts-bulk-action-bar";
import { AdminPostsListView } from "@/components/admin/admin-posts-list-view";
import { AdminPostsGridView } from "@/components/admin/admin-posts-grid-view";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { Button } from "@nocoo/basalt/components/button";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@nocoo/basalt/components/toggle-group";

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
    <ToggleGroup
      type="single"
      value={viewMode}
      onValueChange={(value) => {
        if (value === "list" || value === "grid") onChange(value);
      }}
      aria-label="视图"
    >
      <ToggleGroupItem value="list" aria-label="列表视图">
        <LayoutList className="h-4 w-4" strokeWidth={1.5} />
      </ToggleGroupItem>
      <ToggleGroupItem value="grid" aria-label="网格视图">
        <LayoutGrid className="h-4 w-4" strokeWidth={1.5} />
      </ToggleGroupItem>
    </ToggleGroup>
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

  const handleViewModeChange = (mode: ViewMode) => {
    localStorage.setItem(VIEW_MODE_KEY, mode);
    window.dispatchEvent(new StorageEvent("storage", { key: VIEW_MODE_KEY }));
  };

  const totalPages = Math.ceil(total / pageSize);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Clear selection whenever the visible page/filter set changes so batch
  // actions never operate on ids that are no longer on screen.
  useEffect(() => {
    void currentParams;
    void currentPage;
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
      <PageHeader
        title="文章"
        description={`共 ${total} 篇文章`}
        actions={
          <>
            <PostFilters
              categories={categories}
              tags={tags}
              yearCounts={yearCounts}
            />
            <ViewModeToggle viewMode={viewMode} onChange={handleViewModeChange} />
            <Button asChild>
              <Link href="/admin/posts/new">新建文章</Link>
            </Button>
          </>
        }
      />

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
