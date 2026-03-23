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
    <nav className="flex items-center justify-between py-8" aria-label="Pagination">
      {currentPage > 1 ? (
        <Link
          href={prevHref}
          className="text-sm text-blog-muted transition-colors hover:text-blog-text"
        >
          &larr; Newer posts
        </Link>
      ) : (
        <span />
      )}

      {hasMore ? (
        <Link
          href={nextHref}
          className="text-sm text-blog-muted transition-colors hover:text-blog-text"
        >
          Older posts &rarr;
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
