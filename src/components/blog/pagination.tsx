import Link from "next/link";
import { t, type Locale } from "@/i18n/translations";

interface PaginationProps {
  currentPage: number;
  hasMore: boolean;
  basePath: string;
  locale: Locale;
  /** Extra query params to preserve (e.g. archive filter) */
  extraParams?: Record<string, string>;
}

export function Pagination({ currentPage, hasMore, basePath, locale, extraParams }: PaginationProps) {
  if (currentPage <= 1 && !hasMore) return null;

  const qs = (page?: number) => {
    const p = new URLSearchParams(extraParams);
    if (page && page > 1) p.set("page", String(page));
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  const prevHref = qs(currentPage - 1);
  const nextHref = qs(currentPage + 1);

  return (
    <nav className="flex items-center justify-between py-8" aria-label={t(locale, "blog.pagination.ariaLabel")}>
      {currentPage > 1 ? (
        <Link
          href={prevHref}
          className="text-sm text-blog-muted transition-colors hover:text-blog-text"
        >
          {t(locale, "blog.pagination.newer")}
        </Link>
      ) : (
        <span />
      )}

      {hasMore ? (
        <Link
          href={nextHref}
          className="text-sm text-blog-muted transition-colors hover:text-blog-text"
        >
          {t(locale, "blog.pagination.older")}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
