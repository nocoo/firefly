"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import type { Category } from "@/models/types";
import { useLocale } from "@/i18n/context";

interface PostFiltersProps {
  categories: Category[];
}

export function PostFilters({ categories }: PostFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const { t } = useLocale();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (value) {
        sp.set(key, value);
      } else {
        sp.delete(key);
      }
      sp.delete("page"); // Reset to page 1 on filter change
      router.push(`/admin/posts?${sp.toString()}`);
    },
    [router, searchParams],
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilter("q", query.trim());
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("admin.filters.searchPosts")}
          className="w-full rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </form>

      {/* Status filter */}
      <select
        value={searchParams.get("status") ?? ""}
        onChange={(e) => updateFilter("status", e.target.value)}
        className="rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">{t("admin.filters.allStatus")}</option>
        <option value="published">{t("admin.filters.published")}</option>
        <option value="draft">{t("admin.filters.draft")}</option>
        <option value="private">{t("admin.filters.private")}</option>
        <option value="archived">{t("admin.filters.archived")}</option>
      </select>

      {/* Category filter */}
      <select
        value={searchParams.get("category") ?? ""}
        onChange={(e) => updateFilter("category", e.target.value)}
        className="rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">{t("admin.filters.allCategories")}</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>
    </div>
  );
}
