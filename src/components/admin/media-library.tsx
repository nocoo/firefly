"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import type { YearCount } from "@/data/entities/media";
import { ConfirmDialog } from "./confirm-dialog";
import {
  buildQuery,
  EMPTY_FILTERS,
  hasActiveFilters,
  type Filters,
  type MediaWithUrl,
} from "./media-library-helpers";
import { MediaLibraryFilterBar } from "./media-library-filter-bar";
import { MediaLibraryGrid } from "./media-library-grid";
import { MediaLibraryPreview } from "./media-library-preview";
import { MediaUploadQueue } from "./media-library-queue";
import { useMediaUpload } from "./media-library-upload";

interface MediaLibraryProps {
  initialMedia: MediaWithUrl[];
  initialTotal: number;
  initialYearCounts: YearCount[];
}

export function MediaLibrary({
  initialMedia,
  initialTotal,
  initialYearCounts,
}: MediaLibraryProps) {
  const [media, setMedia] = useState<MediaWithUrl[]>(initialMedia);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaWithUrl | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<MediaWithUrl | null>(null);
  const pageRef = useRef(1);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag-and-drop upload (delegates to dedicated hook)
  const handleUploadComplete = useCallback((item: MediaWithUrl) => {
    setMedia((prev) => [item, ...prev]);
    setTotal((prev) => prev + 1);
  }, []);
  const upload = useMediaUpload(handleUploadComplete);

  // Re-fetch when filters change
  const fetchMedia = useCallback(
    async (f: Filters, page: number, append: boolean) => {
      const setter = append ? setLoading : setFetching;
      setter(true);
      try {
        const res = await fetch(`/api/media?${buildQuery(f, page)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (append) {
          setMedia((prev) => [...prev, ...data.media]);
        } else {
          setMedia(data.media);
        }
        setTotal(data.total);
        pageRef.current = page;
      } finally {
        setter(false);
      }
    },
    [],
  );

  // Debounced search input → filters.search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((prev) => {
        if (prev.search === searchInput) return prev;
        return { ...prev, search: searchInput };
      });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // Re-fetch when filters change (not on mount — use initialMedia)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchMedia(filters, 1, false);
  }, [filters, fetchMedia]);

  const updateFilter = useCallback((key: keyof Filters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "year" && !value) next.month = "";
      return next;
    });
  }, []);

  const handleSortChange = useCallback((sortBy: string, sortOrder: string) => {
    setFilters((prev) => ({ ...prev, sortBy, sortOrder }));
  }, []);

  const resetFilters = useCallback(() => {
    setSearchInput("");
    setFilters(EMPTY_FILTERS);
  }, []);

  const loadMore = useCallback(async () => {
    await fetchMedia(filters, pageRef.current + 1, true);
  }, [filters, fetchMedia]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/media/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("删除图片失败");
        return;
      }
      setMedia((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setTotal((prev) => prev - 1);
      toast.success("图片已删除");
    } catch {
      toast.error("删除图片失败");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("已复制！");
    } catch {
      // Silently ignore clipboard failures
    }
  }, []);

  const handlePreviewDelete = useCallback((item: MediaWithUrl) => {
    setPreview(null);
    setDeleteTarget(item);
  }, []);

  return (
    <div
      onDragEnter={upload.onDragEnter}
      onDragOver={upload.onDragOver}
      onDragLeave={upload.onDragLeave}
      onDrop={upload.onDrop}
      className="relative"
    >
      {upload.dragOver && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-widget border-2 border-dashed border-primary bg-primary/5 backdrop-blur-sm">
          <Upload className="h-10 w-10 text-primary" />
          <p className="text-sm font-medium text-primary">拖放文件上传</p>
        </div>
      )}

      <MediaUploadQueue
        items={upload.queue}
        uploading={upload.uploading}
        onDismiss={upload.dismissQueue}
      />

      <MediaLibraryFilterBar
        filters={filters}
        searchInput={searchInput}
        initialYearCounts={initialYearCounts}
        onSearchInputChange={setSearchInput}
        onUpdateFilter={updateFilter}
        onSortChange={handleSortChange}
        onReset={resetFilters}
      />

      <p className="mb-4 text-sm text-muted-foreground">
        {fetching ? "..." : `显示 ${media.length} / ${total}`}
      </p>

      {media.length === 0 && !fetching && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-foreground">
            {hasActiveFilters(filters) ? "无匹配结果" : "暂无媒体文件"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasActiveFilters(filters) ? "请调整筛选条件。" : "通过文章编辑器上传图片。"}
          </p>
        </div>
      )}

      {media.length > 0 && (
        <MediaLibraryGrid
          media={media}
          onPreview={setPreview}
          onCopy={copyToClipboard}
          onDelete={setDeleteTarget}
        />
      )}

      {media.length < total && media.length > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-widget border border-border bg-secondary px-6 py-2 text-sm text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "加载更多"}
          </button>
        </div>
      )}

      <MediaLibraryPreview
        preview={preview}
        onClose={() => setPreview(null)}
        onCopy={copyToClipboard}
        onDelete={handlePreviewDelete}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除"
        description="确定删除此图片？该操作将从存储中永久移除。"
        confirmLabel={deleting ? "..." : "删除"}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
