import Link from "next/link";

interface PaginationProps {
  currentPage: number;
  hasMore: boolean;
  basePath: string;
}

export function Pagination({ currentPage, hasMore, basePath }: PaginationProps) {
  if (currentPage <= 1 && !hasMore) return null;

  const prevHref = currentPage === 2
    ? basePath
    : `${basePath}?page=${currentPage - 1}`;
  const nextHref = `${basePath}?page=${currentPage + 1}`;

  return (
    <nav className="flex justify-between items-center py-8" aria-label="Pagination">
      {currentPage > 1 ? (
        <Link
          href={prevHref}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          ← Newer posts
        </Link>
      ) : (
        <span />
      )}

      {hasMore ? (
        <Link
          href={nextHref}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          Older posts →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
