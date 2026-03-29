"use client";

import { useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { useLocale } from "@/i18n/context";

export function SearchInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useLocale();

  // Progressive enhancement: "/" key focuses search input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !isTyping(e)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <form action="/search" method="get" className="blog-search">
      <Search className="blog-search-icon" strokeWidth={1.5} />
      <input
        ref={inputRef}
        name="q"
        type="search"
        placeholder={t("blog.search.placeholder")}
        className="blog-search-input"
      />
      <kbd className="blog-search-kbd">/</kbd>
    </form>
  );
}

/** Don't steal "/" when user is typing in an input/textarea/contenteditable */
function isTyping(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    (e.target as HTMLElement)?.isContentEditable === true
  );
}
