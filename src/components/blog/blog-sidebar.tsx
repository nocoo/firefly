"use client";

import Link from "next/link";
import { Github, Facebook, Linkedin, Mail, FileUser, X, Folder, Tags, Archive } from "lucide-react";
import type { Category, Tag } from "@/models/types";
import type { MonthlyArchive } from "@/data/posts";
import type { SocialLink } from "@/data/settings";
import { useLocale } from "@/i18n/context";
import { SocialLink as SocialLinkComponent } from "./social-link";

// ─── X (Twitter) icon — not in lucide ───
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// ─── Brand → icon mapping ───
const BRAND_ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; isLucide: boolean }> = {
  x: { icon: XIcon, isLucide: false },
  facebook: { icon: Facebook, isLucide: true },
  linkedin: { icon: Linkedin, isLucide: true },
  email: { icon: Mail, isLucide: true },
  github: { icon: Github, isLucide: true },
  resume: { icon: FileUser, isLucide: true },
};

interface BlogSidebarProps {
  variant: "desktop" | "drawer";
  open?: boolean;
  onClose?: () => void;
  categories: Category[];
  tags: Tag[];
  archives: MonthlyArchive[];
  siteName: string;
  siteTagline: string;
  socialLinks: SocialLink[];
}

export function BlogSidebar({
  variant, open, onClose, categories, tags, archives,
  siteName, siteTagline, socialLinks,
}: BlogSidebarProps) {
  const { t } = useLocale();

  const isDrawer = variant === "drawer";
  const isDrawerOpen = isDrawer && open;

  const className = [
    "blog-sidebar",
    isDrawer ? "blog-sidebar-drawer" : "blog-sidebar-desktop",
    isDrawerOpen ? "blog-sidebar-drawer-open" : "",
  ].filter(Boolean).join(" ");

  return (
    <aside
      className={className}
      inert={isDrawer && !open ? true : undefined}
      aria-hidden={isDrawer && !open ? true : undefined}
    >
      <div className="blog-sidebar-inner">
        {/* Drawer close button — CSS hides this for desktop variant */}
        <button
          className="blog-sidebar-close"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>

        {/* Site identity */}
        <div className="blog-site-title">
          <Link href="/">{siteName}</Link>
        </div>
        {siteTagline && <p className="blog-tagline">{siteTagline}</p>}

        {/* Social links */}
        {socialLinks.length > 0 && (
          <div className="blog-social">
            {socialLinks.map((link) => {
              const brandInfo = BRAND_ICONS[link.brand];
              if (!brandInfo) return null;
              return (
                <SocialLinkComponent
                  key={link.url}
                  href={link.brand === "email" ? `mailto:${link.url}` : link.url}
                  name={link.name}
                  brand={link.brand}
                  icon={brandInfo.icon}
                  isLucide={brandInfo.isLucide}
                />
              );
            })}
          </div>
        )}

        {/* Categories */}
        {categories.length > 0 && (
          <nav className="blog-sidebar-section">
            <h3 className="blog-sidebar-heading">
              <Folder className="blog-sidebar-heading-icon" strokeWidth={1.5} />
              {t("blog.sidebar.categories")}
            </h3>
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
            <h3 className="blog-sidebar-heading">
              <Tags className="blog-sidebar-heading-icon" strokeWidth={1.5} />
              {t("blog.sidebar.tags")}
            </h3>
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
            <h3 className="blog-sidebar-heading">
              <Archive className="blog-sidebar-heading-icon" strokeWidth={1.5} />
              {t("blog.sidebar.archives")}
            </h3>
            <ul className="blog-sidebar-list">
              {(() => {
                const now = new Date();
                const cutoffYear = now.getFullYear() - 1;

                const recent: MonthlyArchive[] = [];
                const olderByYear = new Map<number, number>();

                for (const a of archives) {
                  if (a.year >= cutoffYear) {
                    recent.push(a);
                  } else {
                    olderByYear.set(a.year, (olderByYear.get(a.year) ?? 0) + a.count);
                  }
                }

                const olderEntries = [...olderByYear.entries()].sort((a, b) => b[0] - a[0]);

                return (
                  <>
                    {recent.map((a) => (
                      <li key={`${a.year}-${a.month}`}>
                        <Link href={`/archive/${a.year}-${String(a.month).padStart(2, "0")}`}>
                          <span>{a.year} {t("blog.sidebar.yearSuffix")} {a.month} {t("blog.sidebar.monthSuffix")}</span>
                          <span className="blog-sidebar-count">({a.count})</span>
                        </Link>
                      </li>
                    ))}
                    {olderEntries.map(([year, count]) => (
                      <li key={year}>
                        <Link href={`/archive/${year}`}>
                          <span>{year} {t("blog.sidebar.yearSuffix")}</span>
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
  );
}
