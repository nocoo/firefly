import Link from "next/link";
import { t, type Locale } from "@/i18n/translations";

interface PaginationProps {
  currentPage: number;
  hasMore: boolean;
  basePath: string;
  locale: Locale;
}

export function Pagination({ currentPage, hasMore, basePath, locale }: PaginationProps) {
  if (currentPage <= 1 && !hasMore) return null;

  const prevHref = currentPage === 2
    ? basePath
    : `${basePath}?page=${currentPage - 1}`;
  const nextHref = `${basePath}?page=${currentPage + 1}`;

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
