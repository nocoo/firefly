"use client";

import { useRef } from "react";
import { Search, X, RotateCcw } from "lucide-react";
import { Select } from "@/components/ui/select";
import type { YearCount } from "@/data/entities/media";
import {
  hasActiveFilters,
  MONTH_LABELS,
  MONTHS,
  type Filters,
} from "./media-library-helpers";

export function MediaLibraryFilterBar({
  filters,
  searchInput,
  initialYearCounts,
  onSearchInputChange,
  onUpdateFilter,
  onSortChange,
  onReset,
}: {
  filters: Filters;
  searchInput: string;
  initialYearCounts: YearCount[];
  onSearchInputChange: (value: string) => void;
  onUpdateFilter: (key: keyof Filters, value: string) => void;
  onSortChange: (sortBy: string, sortOrder: string) => void;
  onReset: () => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={searchRef}
          type="text"
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          placeholder="搜索文件..."
          className="w-full rounded-widget border border-border bg-secondary pl-8 pr-8 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => {
              onSearchInputChange("");
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
        onChange={(e) => onUpdateFilter("mimeType", e.target.value)}
        className="w-auto"
      >
        <option value="">所有类型</option>
        <option value="image/jpeg">JPEG</option>
        <option value="image/png">PNG</option>
        <option value="image/webp">WebP</option>
        <option value="image/gif">GIF</option>
        <option value="image/svg">SVG</option>
      </Select>

      {/* Year filter */}
      <Select
        value={filters.year}
        onChange={(e) => onUpdateFilter("year", e.target.value)}
        className="w-auto"
      >
        <option value="">全部年份</option>
        {initialYearCounts.map(({ year, count }) => (
          <option key={year} value={String(year)}>
            {year} ({count})
          </option>
        ))}
      </Select>

      {/* Month filter */}
      <Select
        value={filters.month}
        onChange={(e) => onUpdateFilter("month", e.target.value)}
        className="w-auto"
        disabled={!filters.year}
      >
        <option value="">全部月份</option>
        {MONTHS.map((m) => (
          <option key={m} value={String(m)}>
            {MONTH_LABELS[m]}
          </option>
        ))}
      </Select>

      {/* Sort */}
      <Select
        value={`${filters.sortBy}-${filters.sortOrder}`}
        onChange={(e) => {
          const [by, order] = e.target.value.split("-");
          onSortChange(by, order);
        }}
        className="w-auto"
      >
        <option value="created_at-desc">最新优先</option>
        <option value="created_at-asc">最早优先</option>
        <option value="size-desc">最大优先</option>
        <option value="size-asc">最小优先</option>
        <option value="filename-asc">名称 A–Z</option>
      </Select>

      {/* Reset */}
      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded-widget border border-border bg-secondary px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
          重置
        </button>
      )}
    </div>
  );
}
