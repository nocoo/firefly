"use client";

import Link from "next/link";
import { Rss, ArrowUp } from "lucide-react";
import { t, type Locale } from "@/i18n/translations";

interface BlogFooterProps {
  locale: Locale;
  siteName: string;
}

export function BlogFooter({ locale, siteName }: BlogFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="blog-footer">
      <div className="flex items-center justify-between">
        <span>{t(locale, "blog.footer.copyright", { year, siteName })}</span>
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
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex items-center gap-1 text-blog-muted transition-colors hover:text-blog-text"
            aria-label={t(locale, "blog.footer.backToTop")}
          >
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </footer>
  );
}
