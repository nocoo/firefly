import Link from "next/link";
import { t, type Locale } from "@/i18n/translations";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
  locale: Locale;
  /** Extra query params to preserve (e.g. archive filter) */
  extraParams?: Record<string, string>;
}

export function Pagination({
  currentPage,
  totalPages,
  basePath,
  locale,
  extraParams,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const href = (page: number) => {
    const p = new URLSearchParams(extraParams);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
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
      aria-label={t(locale, "blog.pagination.ariaLabel")}
    >
      {/* Previous */}
      {currentPage > 1 ? (
        <Link href={href(currentPage - 1)} className={`${linkClass} ${inactiveClass}`}>
          «
        </Link>
      ) : (
        <span className={`${linkClass} ${disabledClass}`}>«</span>
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
          <Link key={slot} href={href(slot)} className={`${linkClass} ${inactiveClass}`}>
            {slot}
          </Link>
        ),
      )}

      {/* Next */}
      {currentPage < totalPages ? (
        <Link href={href(currentPage + 1)} className={`${linkClass} ${inactiveClass}`}>
          »
        </Link>
      ) : (
        <span className={`${linkClass} ${disabledClass}`}>»</span>
      )}
    </nav>
  );
}

/**
 * Build an array of page numbers and "..." ellipsis markers.
 * Always includes first page, last page, and pages around current.
 *
 * Examples (current=6, total=20):
 *   [1, "...", 5, 6, 7, "...", 20]
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
  // Current and neighbors
  for (let i = current - 1; i <= current + 1; i++) {
    if (i >= 1 && i <= total) slots.add(i);
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
