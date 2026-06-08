import { forwardRef } from "react";
import Link from "next/link";
import { Mail, FileUser, Folder, Tags, Archive } from "lucide-react";
import { Github, Facebook, Linkedin } from "@/components/icons/brand";
import type { Category, Tag } from "@/models/types";
import type { MonthlyArchive } from "@/data/entities/post";
import type { SocialLink } from "@/data/settings";
import { SocialLink as SocialLinkComponent } from "./social-link";
import { SearchInput } from "./search-input";

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const BRAND_ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; isLucide: boolean }> = {
  x: { icon: XIcon, isLucide: false },
  facebook: { icon: Facebook, isLucide: true },
  linkedin: { icon: Linkedin, isLucide: true },
  email: { icon: Mail, isLucide: true },
  github: { icon: Github, isLucide: true },
  resume: { icon: FileUser, isLucide: true },
};

interface BlogSidebarProps {
  categories: Category[];
  tags: Tag[];
  archives: MonthlyArchive[];
  siteName: string;
  siteTagline: string;
  socialLinks: SocialLink[];
  drawerOpen?: boolean;
  isMobile?: boolean;
  onDrawerClose?: () => void;
}

export const BlogSidebar = forwardRef<HTMLElement, BlogSidebarProps>(function BlogSidebar({
  categories, tags, archives, siteName, siteTagline, socialLinks,
  drawerOpen = false, isMobile = false,
}, ref) {
  // On mobile when closed, hide from a11y tree + disable keyboard focus
  const inert = isMobile && !drawerOpen;
  // Modal semantics only meaningful while the drawer is actually displayed
  const modalProps = isMobile && drawerOpen
    ? { role: "dialog" as const, "aria-modal": true as const }
    : {};

  return (
    <aside
      ref={ref}
      id="blog-sidebar"
      className={`blog-sidebar blog-sidebar-desktop${drawerOpen ? " blog-sidebar-open" : ""}`}
      aria-label="Site navigation"
      aria-hidden={inert ? true : undefined}
      inert={inert || undefined}
      tabIndex={-1}
      {...modalProps}
    >
      {/* top-left: identity (lizheng pattern) */}
      <div className="blog-sidebar-top">
        <h1 className="blog-site-title">
          <Link href="/" prefetch={false}>{siteName}</Link>
        </h1>
        {siteTagline && <p className="blog-tagline">{siteTagline}</p>}

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
      </div>

      {/* bottom-left: search + nav modules */}
      <div className="blog-sidebar-bottom">
        <SearchInput />

        {categories.length > 0 && (
          <nav className="blog-sidebar-section">
            <h3 className="blog-sidebar-heading">
              <Folder className="blog-sidebar-heading-icon" strokeWidth={1.5} />
              分类
            </h3>
            <ul className="blog-sidebar-list">
              {categories.map((cat) => (
                <li key={cat.id}>
                  <Link href={`/category/${cat.slug}`} prefetch={false}>
                    <span>{cat.name}</span>
                    <span className="blog-sidebar-count">{cat.post_count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {tags.length > 0 && (
          <nav className="blog-sidebar-section">
            <h3 className="blog-sidebar-heading">
              <Tags className="blog-sidebar-heading-icon" strokeWidth={1.5} />
              标签
            </h3>
            <div className="blog-tag-cloud">
              {(() => {
                const counts = tags.map((tg) => tg.post_count ?? 0);
                const maxCount = Math.max(...counts, 1);
                const minSize = 0.8125;
                const maxSize = 1.375;
                return tags.map((tag) => {
                  const weight = (tag.post_count ?? 0) / maxCount;
                  const size = minSize + weight * (maxSize - minSize);
                  return (
                    <Link
                      key={tag.id}
                      href={`/tag/${tag.slug}`}
                      prefetch={false}
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

        {archives.length > 0 && (
          <nav className="blog-sidebar-section">
            <h3 className="blog-sidebar-heading">
              <Archive className="blog-sidebar-heading-icon" strokeWidth={1.5} />
              归档
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
                        <Link href={`/archive/${a.year}-${String(a.month).padStart(2, "0")}`} prefetch={false}>
                          <span>{a.year} 年 {a.month} 月</span>
                          <span className="blog-sidebar-count">{a.count}</span>
                        </Link>
                      </li>
                    ))}
                    {olderEntries.map(([year, count]) => (
                      <li key={year}>
                        <Link href={`/archive/${year}`} prefetch={false}>
                          <span>{year} 年</span>
                          <span className="blog-sidebar-count">{count}</span>
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
});
