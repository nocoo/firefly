import Link from "next/link";
import { Github, Facebook, Linkedin, Mail, FileUser } from "lucide-react";
import type { Category, Tag } from "@/models/types";
import type { MonthlyArchive } from "@/data/posts";
import { t, type Locale } from "@/i18n/translations";

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
  { name: "X", href: "https://x.com/zhengli", icon: XIcon, isLucide: false },
  { name: "Facebook", href: "https://www.facebook.com/zhengli", icon: Facebook, isLucide: true },
  { name: "LinkedIn", href: "https://www.linkedin.com/in/nocoo/", icon: Linkedin, isLucide: true },
  { name: "Email", href: "mailto:nicnocquee@gmail.com", icon: Mail, isLucide: true },
  { name: "GitHub", href: "https://github.com/nocoo", icon: Github, isLucide: true },
  { name: "Resume", href: "https://lizheng.dev/", icon: FileUser, isLucide: true },
];

interface BlogSidebarProps {
  locale: Locale;
  categories: Category[];
  tags: Tag[];
  archives: MonthlyArchive[];
}

export function BlogSidebar({ locale, categories, tags, archives }: BlogSidebarProps) {
  return (
    <aside className="blog-sidebar">
      <div className="blog-sidebar-inner">
        {/* Site identity */}
        <div className="blog-site-title">
          <Link href="/">LIZHENG.ME</Link>
        </div>
        <p className="blog-tagline">{t(locale, "blog.sidebar.tagline")}</p>

        {/* Social links */}
        <div className="blog-social">
          {SOCIAL_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.name}
                href={link.href}
                title={link.name}
                target={link.href.startsWith("mailto:") ? undefined : "_blank"}
                rel={link.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                className="blog-social-link"
              >
                {link.isLucide ? (
                  <Icon className="blog-social-icon" strokeWidth={1.5} />
                ) : (
                  <Icon className="blog-social-icon" />
                )}
              </a>
            );
          })}
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <nav className="blog-sidebar-section">
            <h3 className="blog-sidebar-heading">{t(locale, "blog.sidebar.categories")}</h3>
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
            <h3 className="blog-sidebar-heading">{t(locale, "blog.sidebar.tags")}</h3>
            <div className="blog-tag-cloud">
              {(() => {
                const counts = tags.map((tg) => tg.post_count ?? 0);
                const maxCount = Math.max(...counts, 1);
                const minSize = 0.75;
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

        {/* Monthly archives */}
        {archives.length > 0 && (
          <nav className="blog-sidebar-section">
            <h3 className="blog-sidebar-heading">{t(locale, "blog.sidebar.archives")}</h3>
            <ul className="blog-sidebar-list">
              {archives.map((a) => (
                <li key={`${a.year}-${a.month}`}>
                  <Link href={`/?archive=${a.year}-${String(a.month).padStart(2, "0")}`}>
                    <span>{a.year} {t(locale, "blog.sidebar.yearSuffix")} {a.month} {t(locale, "blog.sidebar.monthSuffix")}</span>
                    <span className="blog-sidebar-count">({a.count})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </aside>
  );
}
