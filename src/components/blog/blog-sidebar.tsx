"use client";

import Link from "next/link";
import type { Category, Tag } from "@/models/types";
import type { MonthlyArchive } from "@/data/posts";
import { ThemeToggle } from "@/components/theme-toggle";

// ─── Social links config ───
const SOCIAL_LINKS = [
  {
    name: "GitHub",
    href: "https://github.com/nicnocquee",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    ),
  },
  {
    name: "Twitter",
    href: "https://x.com/nicnocquee",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    name: "RSS",
    href: "/feed.xml",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M6.18 15.64a2.18 2.18 0 012.18 2.18C8.36 19.01 7.37 20 6.18 20 5 20 4 19.01 4 17.82a2.18 2.18 0 012.18-2.18M4 4.44A15.56 15.56 0 0119.56 20h-2.83A12.73 12.73 0 004 7.27V4.44m0 5.66a9.9 9.9 0 019.9 9.9h-2.83A7.07 7.07 0 004 12.93V10.1z" />
      </svg>
    ),
  },
  {
    name: "Email",
    href: "mailto:nicnocquee@gmail.com",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
  },
  {
    name: "Telegram",
    href: "https://t.me/nicnocquee",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
];

// ─── Month name helper ───
const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface BlogSidebarProps {
  categories: Category[];
  tags: Tag[];
  archives: MonthlyArchive[];
}

export function BlogSidebar({ categories, tags, archives }: BlogSidebarProps) {
  return (
    <aside className="blog-sidebar">
      <div className="blog-sidebar-inner">
        {/* Site identity */}
        <div className="blog-site-title">
          <Link href="/">LIZHENG.ME</Link>
        </div>
        <p className="blog-tagline">知白守黑，不语万千算</p>
        <p className="blog-tagline" style={{ marginTop: "0.15em", fontSize: "0.75em" }}>
          Personal blog by Li Zheng — technology, design, and life.
        </p>

        {/* Social links + Theme toggle */}
        <div className="blog-social">
          {SOCIAL_LINKS.map((link) => (
            <a
              key={link.name}
              href={link.href}
              title={link.name}
              target={link.href.startsWith("/") ? undefined : "_blank"}
              rel={link.href.startsWith("/") ? undefined : "noopener noreferrer"}
            >
              {link.icon}
            </a>
          ))}
          <ThemeToggle />
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <nav className="blog-sidebar-section">
            <h3 className="blog-sidebar-heading">Categories</h3>
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

        {/* Tags */}
        {tags.length > 0 && (
          <nav className="blog-sidebar-section">
            <h3 className="blog-sidebar-heading">Tags</h3>
            <div className="blog-tag-cloud">
              {tags.map((tag) => (
                <Link key={tag.id} href={`/tag/${tag.slug}`}>
                  {tag.name}
                </Link>
              ))}
            </div>
          </nav>
        )}

        {/* Monthly archives */}
        {archives.length > 0 && (
          <nav className="blog-sidebar-section">
            <h3 className="blog-sidebar-heading">Archives</h3>
            <ul className="blog-sidebar-list">
              {archives.map((a) => (
                <li key={`${a.year}-${a.month}`}>
                  <Link href={`/?archive=${a.year}-${String(a.month).padStart(2, "0")}`}>
                    <span>{MONTH_NAMES[a.month]} {a.year}</span>
                    <span className="blog-sidebar-count">{a.count}</span>
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
