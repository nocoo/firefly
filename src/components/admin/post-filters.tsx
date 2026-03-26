"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { X, RotateCcw } from "lucide-react";
import type { Category } from "@/models/types";
import { Select } from "@/components/ui/select";
import { useLocale } from "@/i18n/context";

interface PostFiltersProps {
  categories: Category[];
}

// Generate year options from current year down to a reasonable minimum
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2005;
const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - MIN_YEAR + 1 },
  (_, i) => CURRENT_YEAR - i,
);

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function PostFilters({ categories }: PostFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const { t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local query state when URL params change externally
  useEffect(() => {
    setQuery(searchParams.get("q") ?? ""); // eslint-disable-line react-hooks/set-state-in-effect
  }, [searchParams]);

  // Keyboard shortcut: Cmd+K / Ctrl+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilter("q", query.trim());
  };

  const clearSearch = () => {
    setQuery("");
    updateFilter("q", "");
    inputRef.current?.focus();
  };

  const resetAllFilters = () => {
    setQuery("");
    router.push("/admin/posts");
  };

  const hasActiveFilters =
    searchParams.has("q") ||
    searchParams.has("status") ||
    searchParams.has("category") ||
    searchParams.has("year") ||
    searchParams.has("month");

  const currentYear = searchParams.get("year") ?? "";
  const currentMonth = searchParams.get("month") ?? "";

  // Detect Mac platform after mount to avoid SSR/client hydration mismatch
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.userAgent)); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px]">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("admin.filters.searchPosts")}
          className="w-full rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 pr-16 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query ? (
            <button
              type="button"
              onClick={clearSearch}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          ) : (
            <kbd className="pointer-events-none hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 text-[10px] font-medium text-muted-foreground">
              {isMac ? "⌘" : "Ctrl+"}K
            </kbd>
          )}
        </div>
      </form>

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

      {/* Year filter */}
      <Select
        value={currentYear}
        onChange={(e) => updateFilter("year", e.target.value)}
        className="w-auto"
      >
        <option value="">{t("admin.filters.allYears")}</option>
        {YEAR_OPTIONS.map((year) => (
          <option key={year} value={String(year)}>
            {year}
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
