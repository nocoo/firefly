"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { RotateCcw } from "lucide-react";
import type { Category, Tag } from "@/models/types";
import type { PostYearCount } from "@/data/entities/post";
import { Select } from "@/components/ui/select";

const MONTH_LABELS = ["", "一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];

interface PostFiltersProps {
  categories: Category[];
  tags: Tag[];
  yearCounts: PostYearCount[];
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function PostFilters({ categories, tags, yearCounts }: PostFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (value) {
        sp.set(key, value);
      } else {
        sp.delete(key);
      }
      // Clear month when year is cleared
      if (key === "year" && !value) {
        sp.delete("month");
      }
      sp.delete("page"); // Reset to page 1 on filter change
      router.push(`/admin/posts?${sp.toString()}`);
    },
    [router, searchParams],
  );

  const resetAllFilters = () => {
    router.push("/admin/posts");
  };

  const hasActiveFilters =
    searchParams.has("status") ||
    searchParams.has("category") ||
    searchParams.has("tag") ||
    searchParams.has("year") ||
    searchParams.has("month");

  const currentYear = searchParams.get("year") ?? "";
  const currentMonth = searchParams.get("month") ?? "";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status filter */}
      <Select
        value={searchParams.get("status") ?? ""}
        onChange={(e) => updateFilter("status", e.target.value)}
        className="w-auto"
      >
        <option value="">全部状态</option>
        <option value="published">已发布</option>
        <option value="draft">草稿</option>
        <option value="private">私密</option>
        <option value="archived">已归档</option>
      </Select>

      {/* Category filter */}
      <Select
        value={searchParams.get("category") ?? ""}
        onChange={(e) => updateFilter("category", e.target.value)}
        className="w-auto"
      >
        <option value="">全部分类</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </Select>

      {/* Tag filter */}
      {tags.length > 0 && (
        <Select
          value={searchParams.get("tag") ?? ""}
          onChange={(e) => updateFilter("tag", e.target.value)}
          className="w-auto"
        >
          <option value="">全部标签</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </Select>
      )}

      {/* Year filter */}
      <Select
        value={currentYear}
        onChange={(e) => updateFilter("year", e.target.value)}
        className="w-auto"
      >
        <option value="">全部年份</option>
        {yearCounts.map(({ year, count }) => (
          <option key={year} value={String(year)}>
            {year} ({count})
          </option>
        ))}
      </Select>

      {/* Month filter — only enabled when year is selected */}
      <Select
        value={currentMonth}
        onChange={(e) => updateFilter("month", e.target.value)}
        className="w-auto"
        disabled={!currentYear}
      >
        <option value="">全部月份</option>
        {MONTHS.map((m) => (
          <option key={m} value={String(m)}>
            {MONTH_LABELS[m]}
          </option>
        ))}
      </Select>

      {/* Reset all filters */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={resetAllFilters}
          className="inline-flex items-center gap-1 rounded-widget border border-border bg-secondary px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
          重置
        </button>
      )}
    </div>
  );
}
