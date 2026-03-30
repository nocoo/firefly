"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { RotateCcw } from "lucide-react";
import type { Category, Tag } from "@/models/types";
import type { PostYearCount } from "@/data/entities/post";
import { Select } from "@/components/ui/select";
import { useLocale } from "@/i18n/context";

interface PostFiltersProps {
  categories: Category[];
  tags: Tag[];
  yearCounts: PostYearCount[];
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function PostFilters({ categories, tags, yearCounts }: PostFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();

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
        <option value="">{t("admin.filters.allStatus")}</option>
        <option value="published">{t("admin.filters.published")}</option>
        <option value="draft">{t("admin.filters.draft")}</option>
        <option value="private">{t("admin.filters.private")}</option>
        <option value="archived">{t("admin.filters.archived")}</option>
      </Select>

      {/* Category filter */}
      <Select
        value={searchParams.get("category") ?? ""}
        onChange={(e) => updateFilter("category", e.target.value)}
        className="w-auto"
      >
        <option value="">{t("admin.filters.allCategories")}</option>
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
          <option value="">{t("admin.filters.allTags")}</option>
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
        <option value="">{t("admin.filters.allYears")}</option>
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
        <option value="">{t("admin.filters.allMonths")}</option>
        {MONTHS.map((m) => (
          <option key={m} value={String(m)}>
            {t(`blog.month.${m}`)}
          </option>
        ))}
      </Select>

      {/* Reset all filters */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={resetAllFilters}
          className="inline-flex items-center gap-1 rounded-[var(--radius-widget)] border border-border bg-secondary px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
          {t("admin.filters.resetFilters")}
        </button>
      )}
    </div>
  );
}
