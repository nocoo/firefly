"use client";

import { useEffect, useState } from "react";

/**
 * Top-of-page reading progress bar (1px) for blog post detail pages.
 *
 * Tracks scroll position vs the article body height — full width at the
 * end of the article, 0 at the top. Listens passively so it doesn't fight
 * scroll handlers. Hides itself entirely on prefers-reduced-motion: reduce
 * (decorative chrome, not essential to comprehension).
 *
 * Implemented as a fixed 2px bar along the bottom edge of the topbar,
 * using the public theme accent.
 */
export function ReadingProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;

    const update = () => {
      const scrollY = window.scrollY;
      // Use document scrollHeight so the bar reflects the whole page —
      // including comments and footer — rather than an arbitrary article ref.
      // That matches reader intuition: "I am X% of the way through what's left."
      const full = document.documentElement.scrollHeight - window.innerHeight;
      if (full <= 0) {
        setPct(0);
        return;
      }
      const next = Math.min(100, Math.max(0, (scrollY / full) * 100));
      setPct(next);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 z-40 h-[2px] bg-transparent pointer-events-none"
      style={{ top: "calc(var(--blog-topbar-offset) - 2px)" }}
    >
      <div
        className="h-full origin-left"
        style={{
          width: `${pct}%`,
          background: "var(--blog-accent)",
        }}
      />
    </div>
  );
}
