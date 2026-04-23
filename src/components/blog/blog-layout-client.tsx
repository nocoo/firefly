"use client";

import { useEffect, useState } from "react";
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

export function BlogLayoutClient({
  categories, tags, archives, siteName, siteTagline, socialLinks, children,
}: BlogLayoutClientProps) {
  const pathname = usePathname();
  const isPostDetail = isPostDetailRoute(pathname);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [trackedPath, setTrackedPath] = useState(pathname);
  if (trackedPath !== pathname) {
    setTrackedPath(pathname);
    if (drawerOpen) setDrawerOpen(false);
  }

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  return (
    <>
      <button
        type="button"
        className="blog-sidebar-toggle"
        aria-label={drawerOpen ? "关闭侧边栏" : "打开侧边栏"}
        aria-expanded={drawerOpen}
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
      />

      <main id="main" className="blog-main">
        <div className={`blog-main-inner${isPostDetail ? " blog-main-inner-post" : ""}`}>
          {children}
        </div>
      </main>
    </>
  );
}
