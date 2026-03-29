"use client";

import { useState, useEffect } from "react";
import type { Category, Tag } from "@/models/types";
import type { MonthlyArchive } from "@/data/entities/post";
import type { SocialLink } from "@/data/settings";
import type { Locale } from "@/i18n/translations";
import { BlogSidebar } from "./blog-sidebar";
import { BlogFooter } from "./blog-footer";
import { Menu } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";

const DESKTOP_QUERY = "(min-width: 1200px)";

interface BlogLayoutClientProps {
  categories: Category[];
  tags: Tag[];
  archives: MonthlyArchive[];
  locale: Locale;
  siteName: string;
  siteTagline: string;
  socialLinks: SocialLink[];
  children: React.ReactNode;
}

export function BlogLayoutClient({
  categories, tags, archives, locale, siteName, siteTagline, socialLinks, children,
}: BlogLayoutClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // State convergence: auto-close drawer when entering desktop layout.
  // This is not a layout decision — CSS already hides the drawer at >= 1200px.
  // This cleans up React state so backdrop and scroll-lock don't leak.
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setDrawerOpen(false);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Scroll lock — single owner
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  return (
    <>
      {/* Desktop sidebar — always in DOM, CSS shows/hides via media query */}
      <BlogSidebar
        variant="desktop"
        categories={categories}
        tags={tags}
        archives={archives}
        siteName={siteName}
        siteTagline={siteTagline}
        socialLinks={socialLinks}
      />

      {/* Hamburger — always in DOM, CSS shows/hides via media query */}
      <div className="blog-mobile-bar">
        <IconButton onClick={() => setDrawerOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </IconButton>
      </div>

      {/* Drawer backdrop — rendered when open */}
      {drawerOpen && (
        <div
          className="blog-sidebar-backdrop"
          onClick={() => setDrawerOpen(false)}
          role="button"
          aria-label="Close menu"
          tabIndex={-1}
        />
      )}

      {/* Drawer sidebar — always in DOM, CSS + inert control visibility */}
      <BlogSidebar
        variant="drawer"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        categories={categories}
        tags={tags}
        archives={archives}
        siteName={siteName}
        siteTagline={siteTagline}
        socialLinks={socialLinks}
      />

      <main id="main" className="blog-main">
        {children}
        <BlogFooter locale={locale} siteName={siteName} />
      </main>
    </>
  );
}
