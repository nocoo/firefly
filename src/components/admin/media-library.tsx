"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Trash2, Copy, FileCode2, Search, X, RotateCcw } from "lucide-react";
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

const PAGE_SIZE = 24;

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
  const pageRef = useRef(1);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
    async (text: string, key: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => setCopiedKey(null), 800);
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((item) => (
            <div
              key={item.id}
              className="group relative overflow-hidden rounded-[var(--radius-widget)] border border-border bg-secondary/30"
            >
              {/* Thumbnail */}
              <div className="aspect-square overflow-hidden bg-secondary">
                <img
                  src={item.url}
                  alt={item.alt_text ?? item.filename}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              </div>

              {/* Info */}
              <div className="p-2.5">
                <p className="truncate text-xs font-medium text-foreground">
                  {item.filename}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                  {item.size != null && <span>{formatFileSize(item.size)}</span>}
                  <span>{formatDate(item.created_at)}</span>
                </div>

                {/* Actions */}
                <div className="mt-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(item.url, `url-${item.id}`)
                    }
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title={t("admin.media.copyUrl")}
                  >
                    <Copy className="h-3 w-3" />
                    {copiedKey === `url-${item.id}`
                      ? t("admin.media.copied")
                      : t("admin.media.copyUrl")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `![${item.filename}](${item.url})`,
                        `md-${item.id}`,
                      )
                    }
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title={t("admin.media.copyMarkdown")}
                  >
                    <FileCode2 className="h-3 w-3" />
                    {copiedKey === `md-${item.id}`
                      ? t("admin.media.copied")
                      : "MD"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title={t("admin.media.delete")}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
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
