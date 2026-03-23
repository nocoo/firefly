"use client";

import Link from "next/link";
import { Github, Facebook, Linkedin, Mail, FileUser, X } from "lucide-react";
import type { Category, Tag } from "@/models/types";
import type { MonthlyArchive } from "@/data/posts";
import { useLocale } from "@/i18n/context";
import { SocialLink } from "./social-link";
import { useEffect } from "react";

// ─── X (Twitter) icon — not in lucide ───
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// ─── Social links config ───
const SOCIAL_LINKS = [
  { name: "X", href: "https://x.com/zhengli", icon: XIcon, isLucide: false, brand: "x" },
  { name: "Facebook", href: "https://www.facebook.com/zhengli", icon: Facebook, isLucide: true, brand: "facebook" },
  { name: "LinkedIn", href: "https://www.linkedin.com/in/nocoo/", icon: Linkedin, isLucide: true, brand: "linkedin" },
  { name: "Email", href: "mailto:nicnocquee@gmail.com", icon: Mail, isLucide: true, brand: "email" },
  { name: "GitHub", href: "https://github.com/nocoo", icon: Github, isLucide: true, brand: "github" },
  { name: "Resume", href: "https://lizheng.dev/", icon: FileUser, isLucide: true, brand: "resume" },
];

interface BlogSidebarProps {
  categories: Category[];
  tags: Tag[];
  archives: MonthlyArchive[];
  isMobile: boolean;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export function BlogSidebar({ categories, tags, archives, isMobile, isMobileOpen, onMobileClose }: BlogSidebarProps) {
  const { t } = useLocale();

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);
  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && isMobileOpen && (
        <div
          className="blog-sidebar-backdrop"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`blog-sidebar ${isMobile ? "blog-sidebar-mobile" : "blog-sidebar-desktop"} ${isMobileOpen ? "blog-sidebar-mobile-open" : ""}`}
      >
        <div className="blog-sidebar-inner">
          {/* Mobile close button */}
          <button
            className="blog-sidebar-close"
            onClick={onMobileClose}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        {/* Site identity */}
        <div className="blog-site-title">
          <Link href="/">LIZHENG.ME</Link>
        </div>
        <p className="blog-tagline">{t( "blog.sidebar.tagline")}</p>

        {/* Social links */}
        <div className="blog-social">
          {SOCIAL_LINKS.map((link) => (
            <SocialLink
              key={link.name}
              href={link.href}
              name={link.name}
              brand={link.brand}
              icon={link.icon}
              isLucide={link.isLucide}
            />
          ))}
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <nav className="blog-sidebar-section">
            <h3 className="blog-sidebar-heading">{t( "blog.sidebar.categories")}</h3>
            <ul className="blog-sidebar-list">
              {categories.map((cat) => (
                <li key={cat.id}>
                  <Link href={`/category/${cat.slug}`}>
                    <span>{cat.name}</span>
                    <span className="blog-sidebar-count">{cat.post_count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* Tags — weighted tag cloud */}
        {tags.length > 0 && (
          <nav className="blog-sidebar-section">
            <h3 className="blog-sidebar-heading">{t( "blog.sidebar.tags")}</h3>
            <div className="blog-tag-cloud">
              {(() => {
                const counts = tags.map((tg) => tg.post_count ?? 0);
                const maxCount = Math.max(...counts, 1);
                const minSize = 0.8125;
                const maxSize = 1.5;
                return tags.map((tag) => {
                  const weight = (tag.post_count ?? 0) / maxCount;
                  const size = minSize + weight * (maxSize - minSize);
                  return (
                    <Link
                      key={tag.id}
                      href={`/tag/${tag.slug}`}
                      style={{ fontSize: `${size}em` }}
                    >
                      {tag.name}
                    </Link>
                  );
                });
              })()}
            </div>
          </nav>
        )}

        {/* Archives — recent 2 years by month, older years aggregated */}
        {archives.length > 0 && (
          <nav className="blog-sidebar-section">
            <h3 className="blog-sidebar-heading">{t( "blog.sidebar.archives")}</h3>
            <ul className="blog-sidebar-list">
              {(() => {
                const now = new Date();
                const cutoffYear = now.getFullYear() - 1; // current year and previous year = recent 2 years

                // Split into recent (by month) and older (aggregate by year)
                const recent: MonthlyArchive[] = [];
                const olderByYear = new Map<number, number>();

                for (const a of archives) {
                  if (a.year >= cutoffYear) {
                    recent.push(a);
                  } else {
                    olderByYear.set(a.year, (olderByYear.get(a.year) ?? 0) + a.count);
                  }
                }

                // Older years sorted descending
                const olderEntries = [...olderByYear.entries()].sort((a, b) => b[0] - a[0]);

                return (
                  <>
                    {recent.map((a) => (
                      <li key={`${a.year}-${a.month}`}>
                        <Link href={`/archive/${a.year}-${String(a.month).padStart(2, "0")}`}>
                          <span>{a.year} {t( "blog.sidebar.yearSuffix")} {a.month} {t( "blog.sidebar.monthSuffix")}</span>
                          <span className="blog-sidebar-count">({a.count})</span>
                        </Link>
                      </li>
                    ))}
                    {olderEntries.map(([year, count]) => (
                      <li key={year}>
                        <Link href={`/archive/${year}`}>
                          <span>{year} {t( "blog.sidebar.yearSuffix")}</span>
                          <span className="blog-sidebar-count">({count})</span>
                        </Link>
                      </li>
                    ))}
                  </>
                );
              })()}
            </ul>
          </nav>
        )}
      </div>
    </aside>
    </>
  );
}
