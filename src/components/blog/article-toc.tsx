"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TocEntry } from "@/models/markdown";

interface ArticleTocProps {
  entries: TocEntry[];
}

/** Sticky, native-link navigation for long public articles. */
export function ArticleToc({ entries }: ArticleTocProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [pip, setPip] = useState<{ y: number; ready: boolean }>({ y: 0, ready: false });

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
      const boundary = (topbar?.getBoundingClientRect().bottom ?? 0) + 48;
      const last = headings[headings.length - 1];
      const remaining =
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      let current = headings[0].id;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > boundary) break;
        current = heading.id;
      }
      const lastTop = last.getBoundingClientRect().top;
      if (remaining <= 24 || lastTop - boundary >= remaining - 1) {
        current = last.id;
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

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !activeId) return;
    const item = list.querySelector("li[data-active]");
    if (!(item instanceof HTMLElement)) return;
    const y = item.offsetTop + item.offsetHeight / 2 - 2.5;
    setPip({ y, ready: true });
  }, [activeId]);

  if (entries.length < 3) return null;

  return (
    <nav className="article-toc" aria-label="目录">
      <p className="article-toc-heading">目录</p>
      <div className="article-toc-track">
        <span
          className="article-toc-pip"
          aria-hidden="true"
          data-ready={pip.ready || undefined}
          style={{ transform: `translateY(${pip.y}px)` }}
        />
        <ul ref={listRef} className="article-toc-list">
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
      </div>
    </nav>
  );
}
