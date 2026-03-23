"use client";

import { useState } from "react";
import type { Category, Tag } from "@/models/types";
import type { MonthlyArchive } from "@/data/posts";
import type { Locale } from "@/i18n/translations";
import { BlogSidebar } from "./blog-sidebar";
import { BlogMobileNav } from "./blog-mobile-nav";
import { BlogFooter } from "./blog-footer";

interface BlogLayoutClientProps {
  categories: Category[];
  tags: Tag[];
  archives: MonthlyArchive[];
  locale: Locale;
  children: React.ReactNode;
}

export function BlogLayoutClient({ categories, tags, archives, locale, children }: BlogLayoutClientProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      <BlogMobileNav
        isOpen={isMobileMenuOpen}
        onToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />
      <BlogSidebar
        categories={categories}
        tags={tags}
        archives={archives}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />
      <main id="main" className="blog-main">
        {children}
        <BlogFooter locale={locale} />
      </main>
    </>
  );
}
