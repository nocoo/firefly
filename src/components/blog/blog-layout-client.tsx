"use client";

import { useState, useEffect } from "react";
import type { Category, Tag } from "@/models/types";
import type { MonthlyArchive } from "@/data/posts";
import type { Locale } from "@/i18n/translations";
import { BlogSidebar } from "./blog-sidebar";
import { BlogFooter } from "./blog-footer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";

interface BlogLayoutClientProps {
  categories: Category[];
  tags: Tag[];
  archives: MonthlyArchive[];
  locale: Locale;
  children: React.ReactNode;
}

export function BlogLayoutClient({ categories, tags, archives, locale, children }: BlogLayoutClientProps) {
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      {/* Desktop sidebar — always visible on non-mobile */}
      {!isMobile && (
        <BlogSidebar
          categories={categories}
          tags={tags}
          archives={archives}
          isMobile={false}
          isMobileOpen={false}
          onMobileClose={() => {}}
        />
      )}

      {/* Mobile: hamburger button in top bar */}
      {isMobile && (
        <div className="blog-mobile-bar">
          <IconButton
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" strokeWidth={1.5} />
          </IconButton>
        </div>
      )}

      {/* Mobile: sidebar overlay */}
      {isMobile && isMobileMenuOpen && (
        <>
          <div
            className="blog-sidebar-backdrop"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <BlogSidebar
            categories={categories}
            tags={tags}
            archives={archives}
            isMobile={true}
            isMobileOpen={true}
            onMobileClose={() => setIsMobileMenuOpen(false)}
          />
        </>
      )}

      <main id="main" className={`blog-main ${isMobile ? "blog-main-mobile" : "blog-main-desktop"}`}>
        {children}
        <BlogFooter locale={locale} />
      </main>
    </>
  );
}
