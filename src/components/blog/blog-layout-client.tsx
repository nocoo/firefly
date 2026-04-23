"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { Category, Tag } from "@/models/types";
import type { MonthlyArchive } from "@/data/entities/post";
import type { SocialLink } from "@/data/settings";
import { BlogSidebar } from "./blog-sidebar";

interface BlogLayoutClientProps {
  categories: Category[];
  tags: Tag[];
  archives: MonthlyArchive[];
  siteName: string;
  siteTagline: string;
  socialLinks: SocialLink[];
  children: React.ReactNode;
}

function isPostDetailRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return /^\/\d{4}\/\d{2}\/[^/]+$/.test(pathname) || pathname.startsWith("/preview/");
}

const MOBILE_QUERY = "(max-width: 768px)";

function subscribeMobile(callback: () => void): () => void {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}
function getMobileSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}
function getMobileServerSnapshot(): boolean {
  return false;
}

export function BlogLayoutClient({
  categories, tags, archives, siteName, siteTagline, socialLinks, children,
}: BlogLayoutClientProps) {
  const pathname = usePathname();
  const isPostDetail = isPostDetailRoute(pathname);

  const isMobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, getMobileServerSnapshot);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [trackedPath, setTrackedPath] = useState(pathname);
  if (trackedPath !== pathname) {
    setTrackedPath(pathname);
    if (drawerOpen) setDrawerOpen(false);
  }
  // Force-close the drawer if we leave the mobile breakpoint, otherwise
  // toggle/backdrop disappear and body stays scroll-locked.
  if (!isMobile && drawerOpen) {
    setDrawerOpen(false);
  }

  // Close on Escape; lock body scroll while drawer is open
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  return (
    <>
      <button
        type="button"
        className="blog-sidebar-toggle"
        aria-label={drawerOpen ? "关闭侧边栏" : "打开侧边栏"}
        aria-expanded={drawerOpen}
        aria-controls="blog-sidebar"
        onClick={() => setDrawerOpen((v) => !v)}
      >
        {drawerOpen ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Menu className="h-5 w-5" strokeWidth={1.5} />}
      </button>

      {drawerOpen && (
        <div
          className="blog-sidebar-backdrop"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <BlogSidebar
        categories={categories}
        tags={tags}
        archives={archives}
        siteName={siteName}
        siteTagline={siteTagline}
        socialLinks={socialLinks}
        drawerOpen={drawerOpen}
        isMobile={isMobile}
        onDrawerClose={() => setDrawerOpen(false)}
      />

      <main id="main" className="blog-main">
        <div className={`blog-main-inner${isPostDetail ? " blog-main-inner-post" : ""}`}>
          {children}
        </div>
      </main>
    </>
  );
}
