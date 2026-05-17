"use client";

import Link from "next/link";

export function AdminPostsPagination({
  totalPages,
  currentPage,
  currentParams,
}: {
  totalPages: number;
  currentPage: number;
  currentParams: Record<string, string | undefined>;
}) {
  const buildHref = (page: number) => {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(currentParams)) {
      if (value) sp.set(key, value);
    }
    if (page > 1) sp.set("page", String(page));
    else sp.delete("page");
    const qs = sp.toString();
    return `/admin/posts${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {`第 ${currentPage} 页 / 共 ${totalPages} 页`}
      </p>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <Link
            key={page}
            href={buildHref(page)}
            className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-widget border px-2 text-sm transition-colors ${
              page === currentPage
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-secondary text-foreground hover:bg-accent"
            }`}
          >
            {page}
          </Link>
        ))}
      </div>
    </div>
  );
}
