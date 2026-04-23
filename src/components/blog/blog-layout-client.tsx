"use client";

import { usePathname } from "next/navigation";
import type { Category, Tag } from "@/models/types";
import type { MonthlyArchive } from "@/data/entities/post";
import type { SocialLink } from "@/data/settings";
import { BlogSidebar } from "./blog-sidebar";
import { BlogFooter } from "./blog-footer";

interface BlogLayoutClientProps {
  categories: Category[];
  tags: Tag[];
  archives: MonthlyArchive[];
  siteName: string;
  siteTagline: string;
  socialLinks: SocialLink[];
  children: React.ReactNode;
}

/**
 * Detect post-detail routes so the inner content max-width tightens to 936px.
 * List pages (home, tag, category, archive, search) keep the wider 1180px.
 */
function isPostDetailRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  // Matches /YYYY/MM/slug — 4-digit year + 2-digit month + slug
  return /^\/\d{4}\/\d{2}\/[^/]+$/.test(pathname) || pathname.startsWith("/preview/");
}

export function BlogLayoutClient({
  categories, tags, archives, siteName, siteTagline, socialLinks, children,
}: BlogLayoutClientProps) {
  const pathname = usePathname();
  const isPostDetail = isPostDetailRoute(pathname);

  return (
    <>
      <BlogSidebar
        categories={categories}
        tags={tags}
        archives={archives}
        siteName={siteName}
        siteTagline={siteTagline}
        socialLinks={socialLinks}
      />

      <main id="main" className="blog-main">
        <div className={`blog-main-inner${isPostDetail ? " blog-main-inner-post" : ""}`}>
          {children}
        </div>
        <BlogFooter siteName={siteName} />
      </main>
    </>
  );
}
