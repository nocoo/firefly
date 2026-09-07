"use client";

import type { ReactNode } from "react";
import type { YearCount } from "@/data/entities/media";
import {
  hasActiveFilters,
  MONTH_LABELS,
  MONTHS,
  type Filters,
} from "./media-library-helpers";
import { FilterBar } from "@nocoo/basalt/components/filter-bar";
import { Input } from "@nocoo/basalt/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nocoo/basalt/components/select";

const ALL = "all";

function FilterSelect({
  value,
  onValueChange,
  placeholder,
  disabled,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      {...(disabled ? { disabled: true } : {})}
    >
      <SelectTrigger size="sm" className="w-[8.5rem]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

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
  const toParam = (value: string) => (value === ALL ? "" : value);

  return (
    <FilterBar
      label="筛选媒体"
      active={hasActiveFilters(filters)}
      onClear={onReset}
      clearLabel="重置"
    >
      <Input
        size="sm"
        type="text"
        value={searchInput}
        onChange={(e) => onSearchInputChange(e.target.value)}
        placeholder="搜索文件..."
        className="min-w-[180px] flex-1"
      />

      <FilterSelect
        value={filters.mimeType || ALL}
        onValueChange={(value) => onUpdateFilter("mimeType", toParam(value))}
        placeholder="所有类型"
      >
        <SelectItem value={ALL}>所有类型</SelectItem>
        <SelectItem value="image/jpeg">JPEG</SelectItem>
        <SelectItem value="image/png">PNG</SelectItem>
        <SelectItem value="image/webp">WebP</SelectItem>
        <SelectItem value="image/gif">GIF</SelectItem>
        <SelectItem value="image/svg">SVG</SelectItem>
      </FilterSelect>

      <FilterSelect
        value={filters.year || ALL}
        onValueChange={(value) => onUpdateFilter("year", toParam(value))}
        placeholder="全部年份"
      >
        <SelectItem value={ALL}>全部年份</SelectItem>
        {initialYearCounts.map(({ year, count }) => (
          <SelectItem key={year} value={String(year)}>
            {year} ({count})
          </SelectItem>
        ))}
      </FilterSelect>

      <FilterSelect
        value={filters.month || ALL}
        onValueChange={(value) => onUpdateFilter("month", toParam(value))}
        placeholder="全部月份"
        disabled={!filters.year}
      >
        <SelectItem value={ALL}>全部月份</SelectItem>
        {MONTHS.map((m) => (
          <SelectItem key={m} value={String(m)}>
            {MONTH_LABELS[m]}
          </SelectItem>
        ))}
      </FilterSelect>

      <FilterSelect
        value={`${filters.sortBy}-${filters.sortOrder}`}
        onValueChange={(value) => {
          const [by, order] = value.split("-");
          onSortChange(by, order);
        }}
        placeholder="排序"
      >
        <SelectItem value="created_at-desc">最新优先</SelectItem>
        <SelectItem value="created_at-asc">最早优先</SelectItem>
        <SelectItem value="size-desc">最大优先</SelectItem>
        <SelectItem value="size-asc">最小优先</SelectItem>
        <SelectItem value="filename-asc">名称 A–Z</SelectItem>
      </FilterSelect>
    </FilterBar>
  );
}
