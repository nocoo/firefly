import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildPageSlots } from "@/lib/pagination";

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
    "inline-flex h-8 min-w-8 items-center justify-center px-2 font-mono text-sm transition-colors";
  const activeClass =
    "text-blog-text font-semibold underline decoration-blog-accent decoration-2 underline-offset-4";
  const inactiveClass = "text-blog-muted hover:text-blog-text";
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
