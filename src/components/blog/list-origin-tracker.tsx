"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "blog:list-origin";

/**
 * Drop this into any list page (home, category, tag, archive).
 * On mount / pathname change it writes the current path to sessionStorage
 * so the article detail page can read it as the "back" target.
 */
export function ListOriginTracker() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, pathname);
    } catch {
      // Private browsing or storage full — ignore
    }
  }, [pathname]);

  return null;
}

/**
 * Read the stored list origin. Returns pathname string or null.
 */
export function getListOrigin(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
