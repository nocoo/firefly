"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/i18n/translations";
import { t } from "@/i18n/translations";
import { getListOrigin } from "@/components/blog/list-origin-tracker";

interface ArticleNavProps {
  prevHref: string | null;
  prevTitle: string | null;
  nextHref: string | null;
  nextTitle: string | null;
  locale: Locale;
}

/**
 * Resolve the "back" link from sessionStorage (written by ListOriginTracker).
 * Falls back to "/" when no origin is stored.
 */
function resolveBackLink(): { href: string; labelKey: string } {
  if (typeof window === "undefined") {
    return { href: "/", labelKey: "blog.post.backToAll" };
  }

  const path = getListOrigin();
  if (!path) return { href: "/", labelKey: "blog.post.backToAll" };

  if (path.startsWith("/category/")) {
    return { href: path, labelKey: "blog.post.backToCategory" };
  }
  if (path.startsWith("/tag/")) {
    return { href: path, labelKey: "blog.post.backToTag" };
  }
  if (path.startsWith("/archive/")) {
    return { href: path, labelKey: "blog.post.backToArchive" };
  }
  // Paginated home: /page/2 etc.
  if (path.startsWith("/page/")) {
    return { href: path, labelKey: "blog.post.backToAll" };
  }

  return { href: "/", labelKey: "blog.post.backToAll" };
}

/**
 * Bottom navigation bar for article detail pages.
 * Shows back link (context-aware), prev/next post links with keyboard
 * shortcut hints, and listens for keyboard shortcuts.
 *
 * ← or J = previous (older) post
 * → or K = next (newer) post
 * H = back to list (context-aware)
 */
export function ArticleNav({
  prevHref,
  prevTitle,
  nextHref,
  nextTitle,
  locale,
}: ArticleNavProps) {
  const router = useRouter();
  const [back] = useState(resolveBackLink);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "ArrowLeft":
        case "j":
          if (prevHref) {
            e.preventDefault();
            router.push(prevHref);
          }
          break;
        case "ArrowRight":
        case "k":
          if (nextHref) {
            e.preventDefault();
            router.push(nextHref);
          }
          break;
        case "h":
          e.preventDefault();
          router.push(back.href);
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevHref, nextHref, back.href, router]);

  return (
    <nav className="mt-10 border-t border-blog-separator pt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: back to list */}
        <Link
          href={back.href}
          className="text-sm text-blog-text transition-colors hover:text-blog-accent"
        >
          {t(locale, back.labelKey)}{" "}
          <kbd className="blog-kbd">H</kbd>
        </Link>

        {/* Right: prev/next */}
        <div className="flex items-center gap-4 text-sm">
          {prevHref ? (
            <Link
              href={prevHref}
              className="text-blog-text transition-colors hover:text-blog-accent"
              title={prevTitle ?? undefined}
            >
              ← {t(locale, "blog.post.prevPost")}{" "}
              <kbd className="blog-kbd">J</kbd>
            </Link>
          ) : (
            <span className="text-blog-text/30">
              ← {t(locale, "blog.post.prevPost")}{" "}
              <kbd className="blog-kbd">J</kbd>
            </span>
          )}

          {nextHref ? (
            <Link
              href={nextHref}
              className="text-blog-text transition-colors hover:text-blog-accent"
              title={nextTitle ?? undefined}
            >
              {t(locale, "blog.post.nextPost")}{" "}
              <kbd className="blog-kbd">K</kbd> →
            </Link>
          ) : (
            <span className="text-blog-text/30">
              {t(locale, "blog.post.nextPost")}{" "}
              <kbd className="blog-kbd">K</kbd> →
            </span>
          )}
        </div>
      </div>
    </nav>
  );
}
