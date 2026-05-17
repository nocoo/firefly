"use client";

import Link from "next/link";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export function SortableHeader({
  column,
  label,
  currentSortBy,
  currentSortOrder,
  currentParams,
  className = "",
  sortable = true,
}: {
  column: string;
  label: string;
  currentSortBy: string;
  currentSortOrder: string;
  currentParams: Record<string, string | undefined>;
  className?: string;
  sortable?: boolean;
}) {
  if (!sortable) {
    return (
      <th className={`px-4 py-3 text-left font-medium text-muted-foreground ${className}`}>
        {label}
      </th>
    );
  }

  const isActive = currentSortBy === column;
  const nextOrder = isActive && currentSortOrder === "desc" ? "asc" : "desc";
  const ariaSort: "ascending" | "descending" | "none" = isActive
    ? currentSortOrder === "asc" ? "ascending" : "descending"
    : "none";

  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(currentParams)) {
    if (value && key !== "sort_by" && key !== "sort_order" && key !== "page") {
      sp.set(key, value);
    }
  }
  sp.set("sort_by", column);
  sp.set("sort_order", nextOrder);
  const href = `/admin/posts?${sp.toString()}`;

  const Icon = isActive
    ? currentSortOrder === "asc" ? ArrowUp : ArrowDown
    : ArrowUpDown;

  return (
    <th
      className={`px-4 py-3 text-left font-medium text-muted-foreground ${className}`}
      aria-sort={ariaSort}
    >
      <Link
        href={href}
        className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${isActive ? "text-foreground" : ""}`}
      >
        {label}
        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
      </Link>
    </th>
  );
}
