"use client";

import { useEffect, useState } from "react";
import type { TocEntry } from "@/models/markdown";

interface ArticleTocProps {
  entries: TocEntry[];
}

/** Sticky, native-link navigation for long public articles. */
export function ArticleToc({ entries }: ArticleTocProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (entries.length < 3) return;
    const ids = entries.map((e) => e.id);
    const headings = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const topbar = document.querySelector(".blog-topbar");
    let frame = 0;
    const update = () => {
      frame = 0;
      // Match the heading's scroll margin, with a little tolerance. Reading
      // position must survive fast jumps and upward scrolling between headings.
      const boundary = (topbar?.getBoundingClientRect().bottom ?? 0) + 48;
      let current = headings[0].id;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > boundary) break;
        current = heading.id;
      }
      setActiveId(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const resizeObserver = new ResizeObserver(schedule);
    const article = headings[0].closest("article");
    if (article) resizeObserver.observe(article);
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
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
            <a href={`#${e.id}`} aria-current={e.id === activeId ? "location" : undefined}>{e.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
