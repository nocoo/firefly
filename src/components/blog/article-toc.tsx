"use client";

import { useEffect, useState } from "react";
import type { TocEntry } from "@/models/markdown";

interface ArticleTocProps {
  entries: TocEntry[];
}

/**
 * Sticky right-rail table of contents for long blog posts.
 *
 * Server component extracts headings via `extractToc(markdown)`. Client side
 * uses an IntersectionObserver to highlight whichever heading is currently
 * in the upper half of the viewport — same pattern as Vercel docs / Stripe
 * docs, well understood by readers.
 *
 * Hidden on small screens (mobile readers don't have the screen width); on
 * lg+ it lives in a flex sidebar at the right of the article column. Hidden
 * outright when fewer than 3 entries — TOCs only earn their space at length.
 */
export function ArticleToc({ entries }: ArticleTocProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (entries.length === 0) return;
    const ids = entries.map((e) => e.id);
    const headings = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    // rootMargin: top -40% / bottom -55% keeps the active region at roughly
    // the upper-third of the viewport. Heading enters → becomes active when
    // its top crosses that band; out → next heading takes over.
    const observer = new IntersectionObserver(
      (entriesIO) => {
        // Pick the heading that's currently intersecting and closest to the top.
        const visible = entriesIO
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-40% 0% -55% 0%", threshold: 0 },
    );
    for (const h of headings) observer.observe(h);
    return () => observer.disconnect();
  }, [entries]);

  if (entries.length < 3) return null;

  return (
    <nav className="article-toc" aria-label="目录">
      <p className="article-toc-heading">目录</p>
      <ul className="article-toc-list">
        {entries.map((e) => (
          <li
            key={e.id}
            data-depth={e.depth}
            data-active={e.id === activeId || undefined}
          >
            <a href={`#${e.id}`}>{e.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
