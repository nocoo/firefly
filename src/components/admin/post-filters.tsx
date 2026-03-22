"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import type { Category } from "@/models/types";

interface PostFiltersProps {
  categories: Category[];
}

export function PostFilters({ categories }: PostFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

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
          placeholder="Search posts..."
          className="w-full rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </form>

      {/* Status filter */}
      <select
        value={searchParams.get("status") ?? ""}
        onChange={(e) => updateFilter("status", e.target.value)}
        className="rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All Status</option>
        <option value="published">Published</option>
        <option value="draft">Draft</option>
        <option value="private">Private</option>
        <option value="archived">Archived</option>
      </select>

      {/* Category filter */}
      <select
        value={searchParams.get("category") ?? ""}
        onChange={(e) => updateFilter("category", e.target.value)}
        className="rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All Categories</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>
    </div>
  );
}
