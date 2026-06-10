"use client";

import { useRef, useEffect } from "react";
import { Search } from "lucide-react";

export function SearchInput() {
  const inputRef = useRef<HTMLInputElement>(null);

  // Progressive enhancement: "/" key focuses search input.
  //
  // We listen in capture phase on window so other components that bind
  // keydown later (ArticleNav, BlogLayoutClient drawer trap, anything in
  // .blog-content) can't preventDefault before we see the event. Capture
  // phase runs root→target, so we're guaranteed first crack.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Match by `code` (physical key) too — `e.key` is layout-dependent and
      // some IMEs / non-US layouts produce dead-key or alt-graph variants
      // that don't equal "/".
      const isSlash = e.key === "/" || e.code === "Slash";
      if (!isSlash) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e)) return;
      e.preventDefault();
      e.stopPropagation();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () =>
      window.removeEventListener("keydown", handler, { capture: true });
  }, []);

  return (
    <form action="/search" method="get" className="blog-search">
      <Search className="blog-search-icon" strokeWidth={1.5} />
      <input
        ref={inputRef}
        name="q"
        type="search"
        placeholder="搜索..."
        className="blog-search-input"
      />
      <kbd className="blog-search-kbd">/</kbd>
    </form>
  );
}

/** Don't steal "/" when user is typing in an input/textarea/contenteditable */
function isTyping(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable === true
  );
}
