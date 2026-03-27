"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Trash2,
  Copy,
  FileCode2,
  Search,
  X,
  RotateCcw,
  Calendar,
  HardDrive,
  ImageIcon,
  RulerIcon,
} from "lucide-react";
import type { Attachment } from "@/models/types";
import { formatFileSize } from "@/models/backup";
import { ConfirmDialog } from "./confirm-dialog";
import { Select } from "@/components/ui/select";
import { useLocale } from "@/i18n/context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MediaWithUrl extends Attachment {
  url: string;
}

interface MediaLibraryProps {
  initialMedia: MediaWithUrl[];
  initialTotal: number;
}

interface Filters {
  search: string;
  mimeType: string;
  year: string;
  month: string;
  sortBy: string;
  sortOrder: string;
}

const EMPTY_FILTERS: Filters = {
  search: "",
  mimeType: "",
  year: "",
  month: "",
  sortBy: "created_at",
  sortOrder: "desc",
};

const PAGE_SIZE = 120;

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2005;
const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - MIN_YEAR + 1 },
  (_, i) => CURRENT_YEAR - i,
);

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildQuery(filters: Filters, page: number): string {
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  sp.set("page_size", String(PAGE_SIZE));
  if (filters.search) sp.set("search", filters.search);
  if (filters.mimeType) sp.set("mime_type", filters.mimeType);
  if (filters.year) sp.set("year", filters.year);
  if (filters.year && filters.month) sp.set("month", filters.month);
  if (filters.sortBy && filters.sortBy !== "created_at")
    sp.set("sort_by", filters.sortBy);
  if (filters.sortOrder && filters.sortOrder !== "desc")
    sp.set("sort_order", filters.sortOrder);
  return sp.toString();
}

function hasActiveFilters(f: Filters): boolean {
  return (
    f.search !== "" ||
    f.mimeType !== "" ||
    f.year !== "" ||
    f.sortBy !== "created_at" ||
    f.sortOrder !== "desc"
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MediaLibrary({
  initialMedia,
  initialTotal,
}: MediaLibraryProps) {
  const { t } = useLocale();
  const [media, setMedia] = useState<MediaWithUrl[]>(initialMedia);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaWithUrl | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<MediaWithUrl | null>(null);
  const pageRef = useRef(1);

  // Filters
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Debounced search
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

  // Close preview on Escape
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview]);

  const updateFilter = useCallback(
    (key: keyof Filters, value: string) => {
      setFilters((prev) => {
        const next = { ...prev, [key]: value };
        // Clear month when year is cleared
        if (key === "year" && !value) next.month = "";
        return next;
      });
    },
    [],
  );

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
        toast.error(t("admin.media.deleteError"));
        return;
      }
      setMedia((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setTotal((prev) => prev - 1);
      toast.success(t("admin.media.deleted"));
    } catch {
      toast.error(t("admin.media.deleteError"));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, t]);

  const copyToClipboard = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(t("admin.media.copied"));
      } catch {
        // Silently ignore clipboard failures
      }
    },
    [t],
  );

  const formatDate = (epoch: number) => {
    return new Date(epoch * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      {/* ── Filter bar ── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("admin.media.searchPlaceholder")}
            className="w-full rounded-[var(--radius-widget)] border border-border bg-secondary pl-8 pr-8 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                searchRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Type filter */}
        <Select
          value={filters.mimeType}
          onChange={(e) => updateFilter("mimeType", e.target.value)}
          className="w-auto"
        >
          <option value="">{t("admin.media.allTypes")}</option>
          <option value="image/jpeg">JPEG</option>
          <option value="image/png">PNG</option>
          <option value="image/webp">WebP</option>
          <option value="image/gif">GIF</option>
          <option value="image/svg">SVG</option>
        </Select>

        {/* Year filter */}
        <Select
          value={filters.year}
          onChange={(e) => updateFilter("year", e.target.value)}
          className="w-auto"
        >
          <option value="">{t("admin.filters.allYears")}</option>
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </Select>

        {/* Month filter */}
        <Select
          value={filters.month}
          onChange={(e) => updateFilter("month", e.target.value)}
          className="w-auto"
          disabled={!filters.year}
        >
          <option value="">{t("admin.filters.allMonths")}</option>
          {MONTHS.map((m) => (
            <option key={m} value={String(m)}>
              {t(`blog.month.${m}`)}
            </option>
          ))}
        </Select>

        {/* Sort */}
        <Select
          value={`${filters.sortBy}-${filters.sortOrder}`}
          onChange={(e) => {
            const [by, order] = e.target.value.split("-");
            setFilters((prev) => ({ ...prev, sortBy: by, sortOrder: order }));
          }}
          className="w-auto"
        >
          <option value="created_at-desc">{t("admin.media.sortNewest")}</option>
          <option value="created_at-asc">{t("admin.media.sortOldest")}</option>
          <option value="size-desc">{t("admin.media.sortLargest")}</option>
          <option value="size-asc">{t("admin.media.sortSmallest")}</option>
          <option value="filename-asc">{t("admin.media.sortName")}</option>
        </Select>

        {/* Reset */}
        {hasActiveFilters(filters) && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 rounded-[var(--radius-widget)] border border-border bg-secondary px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
            {t("admin.filters.resetFilters")}
          </button>
        )}
      </div>

      {/* ── Count ── */}
      <p className="mb-4 text-sm text-muted-foreground">
        {fetching
          ? "..."
          : t("admin.media.showing")
              .replace("{count}", String(media.length))
              .replace("{total}", String(total))}
      </p>

      {/* ── Empty state ── */}
      {media.length === 0 && !fetching && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-foreground">
            {hasActiveFilters(filters)
              ? t("admin.media.noResults")
              : t("admin.media.empty")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasActiveFilters(filters)
              ? t("admin.media.noResultsHint")
              : t("admin.media.emptyHint")}
          </p>
        </div>
      )}

      {/* ── Grid ── */}
      {media.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-2 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-16">
          {media.map((item) => (
            <div
              key={item.id}
              className="group relative aspect-square overflow-hidden rounded-[var(--radius-sm)] border border-border bg-secondary cursor-pointer"
              onClick={() => setPreview(item)}
            >
              {/* Thumbnail */}
              <img
                src={item.url}
                alt={item.alt_text ?? item.filename}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />

              {/* Hover overlay */}
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                {/* Info */}
                <div className="p-1.5">
                  <p className="truncate text-[10px] font-medium text-white leading-tight">
                    {item.filename}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-white/70">
                    {item.size != null && (
                      <span>{formatFileSize(item.size)}</span>
                    )}
                    <span>{formatDate(item.created_at)}</span>
                  </div>

                  {/* Actions */}
                  <div className="mt-1 flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(item.url);
                      }}
                      className="flex items-center justify-center rounded p-1 text-white/80 hover:text-white hover:bg-white/20 transition-colors"
                      title={t("admin.media.copyUrl")}
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(
                          `![${item.filename}](${item.url})`,
                        );
                      }}
                      className="flex items-center justify-center rounded p-1 text-white/80 hover:text-white hover:bg-white/20 transition-colors"
                      title={t("admin.media.copyMarkdown")}
                    >
                      <FileCode2 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(item);
                      }}
                      className="ml-auto flex items-center justify-center rounded p-1 text-red-400 hover:text-red-300 hover:bg-white/20 transition-colors"
                      title={t("admin.media.delete")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Load more ── */}
      {media.length < total && media.length > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-[var(--radius-widget)] border border-border bg-secondary px-6 py-2 text-sm text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            {loading ? "..." : t("admin.media.loadMore")}
          </button>
        </div>
      )}

      {/* ── Preview lightbox ── */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreview(null)}
        >
          {/* Content — stop propagation so clicking inside doesn't close */}
          <div
            className="relative flex max-h-[90vh] max-w-[90vw] flex-col overflow-hidden rounded-[var(--radius-card)] bg-card shadow-2xl md:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/80 transition-colors hover:bg-black/70 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Image */}
            <div className="flex flex-1 items-center justify-center bg-black/20 p-4 md:min-w-[400px]">
              <img
                src={preview.url}
                alt={preview.alt_text ?? preview.filename}
                className="max-h-[60vh] max-w-full rounded object-contain md:max-h-[80vh]"
              />
            </div>

            {/* Meta panel */}
            <div className="flex w-full flex-col gap-4 border-t border-border p-5 md:w-72 md:border-l md:border-t-0">
              <h3 className="truncate text-sm font-semibold text-foreground">
                {preview.filename}
              </h3>

              <div className="flex flex-col gap-2.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{preview.mime_type}</span>
                </div>
                {preview.size != null && (
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-3.5 w-3.5 shrink-0" />
                    <span>{formatFileSize(preview.size)}</span>
                  </div>
                )}
                {preview.width != null && preview.height != null && (
                  <div className="flex items-center gap-2">
                    <RulerIcon className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {preview.width} x {preview.height}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>{formatDate(preview.created_at)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-auto flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(preview.url)}
                  className="flex items-center justify-center gap-1.5 rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-xs text-foreground transition-colors hover:bg-accent"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {t("admin.media.copyUrl")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      `![${preview.filename}](${preview.url})`,
                    )
                  }
                  className="flex items-center justify-center gap-1.5 rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-xs text-foreground transition-colors hover:bg-accent"
                >
                  <FileCode2 className="h-3.5 w-3.5" />
                  {t("admin.media.copyMarkdown")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setDeleteTarget(preview);
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-[var(--radius-widget)] border border-destructive/30 px-3 py-2 text-xs text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("admin.media.delete")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t("admin.media.delete")}
        description={t("admin.media.confirmDelete")}
        confirmLabel={deleting ? "..." : t("admin.media.delete")}
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
