"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, type ReactNode } from "react";
import type { Category, Tag } from "@/models/types";
import type { PostYearCount } from "@/data/entities/post";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nocoo/basalt/components/select";
import { FilterBar } from "@nocoo/basalt/components/filter-bar";

const ALL = "all";
const MONTH_LABELS = [
  "",
  "一月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "十一月",
  "十二月",
];

interface PostFiltersProps {
  categories: Category[];
  tags: Tag[];
  yearCounts: PostYearCount[];
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

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
      if (key === "year" && !value) {
        sp.delete("month");
      }
      sp.delete("page");
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
  const fromParam = (key: string) => searchParams.get(key) || ALL;
  const toParam = (value: string) => (value === ALL ? "" : value);

  return (
    <FilterBar
      label="筛选文章"
      active={hasActiveFilters}
      onClear={resetAllFilters}
      clearLabel="重置"
    >
      <FilterSelect
        value={fromParam("status")}
        onValueChange={(value) => updateFilter("status", toParam(value))}
        placeholder="全部状态"
      >
        <SelectItem value={ALL}>全部状态</SelectItem>
        <SelectItem value="published">已发布</SelectItem>
        <SelectItem value="draft">草稿</SelectItem>
        <SelectItem value="private">私密</SelectItem>
        <SelectItem value="archived">已归档</SelectItem>
      </FilterSelect>

      <FilterSelect
        value={fromParam("category")}
        onValueChange={(value) => updateFilter("category", toParam(value))}
        placeholder="全部分类"
      >
        <SelectItem value={ALL}>全部分类</SelectItem>
        {categories.map((cat) => (
          <SelectItem key={cat.id} value={cat.id}>
            {cat.name}
          </SelectItem>
        ))}
      </FilterSelect>

      {tags.length > 0 && (
        <FilterSelect
          value={fromParam("tag")}
          onValueChange={(value) => updateFilter("tag", toParam(value))}
          placeholder="全部标签"
        >
          <SelectItem value={ALL}>全部标签</SelectItem>
          {tags.map((tag) => (
            <SelectItem key={tag.id} value={tag.id}>
              {tag.name}
            </SelectItem>
          ))}
        </FilterSelect>
      )}

      <FilterSelect
        value={currentYear || ALL}
        onValueChange={(value) => updateFilter("year", toParam(value))}
        placeholder="全部年份"
      >
        <SelectItem value={ALL}>全部年份</SelectItem>
        {yearCounts.map(({ year, count }) => (
          <SelectItem key={year} value={String(year)}>
            {year} ({count})
          </SelectItem>
        ))}
      </FilterSelect>

      <FilterSelect
        value={currentMonth || ALL}
        onValueChange={(value) => updateFilter("month", toParam(value))}
        placeholder="全部月份"
        disabled={!currentYear}
      >
        <SelectItem value={ALL}>全部月份</SelectItem>
        {MONTHS.map((m) => (
          <SelectItem key={m} value={String(m)}>
            {MONTH_LABELS[m]}
          </SelectItem>
        ))}
      </FilterSelect>
    </FilterBar>
  );
}
