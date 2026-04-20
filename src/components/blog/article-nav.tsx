"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getListOrigin } from "@/components/blog/list-origin-tracker";

interface ArticleNavProps {
  prevHref: string | null;
  prevTitle: string | null;
  nextHref: string | null;
  nextTitle: string | null;
}

interface BackLink {
  href: string;
  label: string;
}

const BACK_DEFAULT: BackLink = { href: "/", label: "← 返回所有文章" };

/**
 * Resolve the "back" link from sessionStorage (written by ListOriginTracker).
 * Falls back to "/" when no origin is stored.
 */
function resolveBackLink(): BackLink {
  const path = getListOrigin();
  if (!path) return BACK_DEFAULT;

  if (path.startsWith("/category/")) {
    return { href: path, label: "← 返回分类" };
  }
  if (path.startsWith("/tag/")) {
    return { href: path, label: "← 返回标签" };
  }
  if (path.startsWith("/archive/")) {
    return { href: path, label: "← 返回归档" };
  }
  // Paginated home: /page/2 etc.
  if (path.startsWith("/page/")) {
    return { href: path, label: "← 返回所有文章" };
  }

  return BACK_DEFAULT;
}

// ---------------------------------------------------------------------------
// useSyncExternalStore adapters — sessionStorage is read-once (no subscribe),
// and the server snapshot ensures SSR ↔ hydration parity.
// ---------------------------------------------------------------------------

const noop = () => () => {};

let _prevOrigin: string | null | undefined;
let _cachedBack: BackLink = BACK_DEFAULT;

function getBackLinkSnapshot(): BackLink {
  const origin = getListOrigin();
  if (origin !== _prevOrigin) {
    _prevOrigin = origin;
    _cachedBack = resolveBackLink();
  }
  return _cachedBack;
}
function getBackLinkServerSnapshot(): BackLink {
  return BACK_DEFAULT;
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
}: ArticleNavProps) {
  const router = useRouter();
  const back = useSyncExternalStore(
    noop,
    getBackLinkSnapshot,
    getBackLinkServerSnapshot,
  );

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
          prefetch={false}
          className="text-sm text-blog-text transition-colors hover:text-blog-accent"
        >
          {back.label}{" "}
          <kbd className="blog-kbd hidden sm:inline" aria-hidden="true">H</kbd>
        </Link>

        {/* Right: prev/next */}
        <div className="flex items-center gap-4 text-sm">
          {prevHref ? (
            <Link
              href={prevHref}
              prefetch={false}
              className="text-blog-text transition-colors hover:text-blog-accent"
              title={prevTitle ?? undefined}
            >
              ← 上一篇{" "}
              <kbd className="blog-kbd hidden sm:inline" aria-hidden="true">J</kbd>
            </Link>
          ) : (
            <span className="text-blog-text/30">
              ← 上一篇{" "}
              <kbd className="blog-kbd hidden sm:inline" aria-hidden="true">J</kbd>
            </span>
          )}

          {nextHref ? (
            <Link
              href={nextHref}
              prefetch={false}
              className="text-blog-text transition-colors hover:text-blog-accent"
              title={nextTitle ?? undefined}
            >
              下一篇{" "}
              <kbd className="blog-kbd hidden sm:inline" aria-hidden="true">K</kbd> →
            </Link>
          ) : (
            <span className="text-blog-text/30">
              下一篇{" "}
              <kbd className="blog-kbd hidden sm:inline" aria-hidden="true">K</kbd> →
            </span>
          )}
        </div>
      </div>
    </nav>
  );
}
