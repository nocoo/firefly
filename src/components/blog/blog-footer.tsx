"use client";

import Link from "next/link";
import { Rss, ArrowUp } from "lucide-react";

interface BlogFooterProps {
  siteName: string;
}

export function BlogFooter({ siteName }: BlogFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="blog-footer">
      <div className="flex items-center justify-between">
        <span>{`© ${year} ${siteName}. 保留所有权利。`}</span>
        <div className="flex items-center gap-3">
          <Link
            href="/feed.xml"
            prefetch={false}
            className="inline-flex items-center gap-1 text-blog-muted transition-colors hover:text-blog-text"
            aria-label="RSS Feed"
          >
            <Rss className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Link>
          <button
            type="button"
            onClick={() => {
              const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
            }}
            className="inline-flex items-center gap-1 text-blog-muted transition-colors hover:text-blog-text"
            aria-label="回到顶部"
          >
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </footer>
  );
}
