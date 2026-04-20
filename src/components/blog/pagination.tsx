import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  /** Base path without trailing slash, e.g. "/" or "/category/tech" or "/archive/2026-02" */
  basePath: string;
  /** When provided, generates query-string pagination (?key=val&page=N)
   *  instead of path-segment pagination (/basePath/page/N). */
  searchParams?: Record<string, string>;
}

export function Pagination({
  currentPage,
  totalPages,
  basePath,
  searchParams,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const href = (page: number) => {
    if (searchParams) {
      // Query-string mode: /search?q=foo&page=2
      const params = new URLSearchParams(searchParams);
      if (page > 1) params.set("page", String(page));
      const qs = params.toString();
      return qs ? `${basePath}?${qs}` : basePath;
    }
    // Path-segment mode (existing behavior): /basePath/page/2
    if (page <= 1) return basePath === "/" ? "/" : basePath;
    const base = basePath === "/" ? "" : basePath;
    return `${base}/page/${page}`;
  };

  // Build page number slots: always show first, last, current ± 1, with ellipses
  const pages = buildPageSlots(currentPage, totalPages);

  const linkClass =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm transition-colors";
  const activeClass = "bg-blog-accent text-white font-medium";
  const inactiveClass = "text-blog-muted hover:text-blog-text hover:bg-blog-accent/10";
  const disabledClass = "text-blog-muted/40 pointer-events-none";

  return (
    <nav
      className="flex items-center justify-center gap-1 py-8"
      aria-label="分页"
    >
      {/* Previous */}
      {currentPage > 1 ? (
        <Link href={href(currentPage - 1)} prefetch={false} className={`${linkClass} ${inactiveClass}`} aria-label="上一页">
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
        </Link>
      ) : (
        <span className={`${linkClass} ${disabledClass}`} aria-hidden="true"><ChevronLeft className="h-4 w-4" strokeWidth={1.5} /></span>
      )}

      {/* Page numbers */}
      {pages.map((slot, i) =>
        slot === "..." ? (
          <span key={`ellipsis-${i}`} className={`${linkClass} ${disabledClass}`}>
            …
          </span>
        ) : slot === currentPage ? (
          <span
            key={slot}
            className={`${linkClass} ${activeClass}`}
            aria-current="page"
          >
            {slot}
          </span>
        ) : (
          <Link key={slot} href={href(slot)} prefetch={false} className={`${linkClass} ${inactiveClass}`}>
            {slot}
          </Link>
        ),
      )}

      {/* Next */}
      {currentPage < totalPages ? (
        <Link href={href(currentPage + 1)} prefetch={false} className={`${linkClass} ${inactiveClass}`} aria-label="下一页">
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </Link>
      ) : (
        <span className={`${linkClass} ${disabledClass}`} aria-hidden="true"><ChevronRight className="h-4 w-4" strokeWidth={1.5} /></span>
      )}
    </nav>
  );
}

/**
 * Build an array of page numbers and "..." ellipsis markers.
 * Always includes first page, last page, and pages around current (±2).
 * Ensures at least 4 consecutive pages at edges.
 *
 * Examples (current=1, total=20):
 *   [1, 2, 3, 4, "...", 20]
 *
 * (current=6, total=20):
 *   [1, "...", 4, 5, 6, 7, 8, "...", 20]
 *
 * (current=1, total=5):
 *   [1, 2, 3, 4, 5]
 */
function buildPageSlots(
  current: number,
  total: number,
): (number | "...")[] {
  // If few enough pages, show all
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const slots = new Set<number>();
  // Always include first and last
  slots.add(1);
  slots.add(total);
  // Current and neighbors ±2
  for (let i = current - 2; i <= current + 2; i++) {
    if (i >= 1 && i <= total) slots.add(i);
  }
  // Ensure at least 4 consecutive pages at edges
  if (current <= 3) {
    for (let i = 1; i <= Math.min(4, total); i++) slots.add(i);
  }
  if (current >= total - 2) {
    for (let i = Math.max(1, total - 3); i <= total; i++) slots.add(i);
  }

  const sorted = [...slots].sort((a, b) => a - b);
  const result: (number | "...")[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push("...");
    }
    result.push(sorted[i]);
  }

  return result;
}
