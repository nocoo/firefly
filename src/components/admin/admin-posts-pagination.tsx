"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildPageSlots } from "@/lib/pagination";

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

  const pages = buildPageSlots(currentPage, totalPages);

  const linkBase =
    "inline-flex h-8 min-w-[2rem] items-center justify-center rounded-widget border px-2 text-sm transition-colors";
  const activeClass = "border-primary bg-primary text-primary-foreground";
  const inactiveClass =
    "border-border bg-secondary text-foreground hover:bg-accent";
  const disabledClass =
    "border-border bg-secondary text-muted-foreground/50 pointer-events-none";

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {`第 ${currentPage} 页 / 共 ${totalPages} 页`}
      </p>
      <nav className="flex items-center gap-1" aria-label="分页">
        {currentPage > 1 ? (
          <Link
            href={buildHref(currentPage - 1)}
            className={`${linkBase} ${inactiveClass}`}
            aria-label="上一页"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </Link>
        ) : (
          <span
            className={`${linkBase} ${disabledClass}`}
            aria-hidden="true"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </span>
        )}

        {pages.map((slot, i) =>
          slot === "..." ? (
            <span
              key={`ellipsis-${i}`}
              className={`${linkBase} border-transparent bg-transparent text-muted-foreground/60 pointer-events-none`}
            >
              …
            </span>
          ) : slot === currentPage ? (
            <span
              key={slot}
              className={`${linkBase} ${activeClass}`}
              aria-current="page"
            >
              {slot}
            </span>
          ) : (
            <Link
              key={slot}
              href={buildHref(slot)}
              className={`${linkBase} ${inactiveClass}`}
            >
              {slot}
            </Link>
          ),
        )}

        {currentPage < totalPages ? (
          <Link
            href={buildHref(currentPage + 1)}
            className={`${linkBase} ${inactiveClass}`}
            aria-label="下一页"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </Link>
        ) : (
          <span
            className={`${linkBase} ${disabledClass}`}
            aria-hidden="true"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </span>
        )}
      </nav>
    </div>
  );
}
