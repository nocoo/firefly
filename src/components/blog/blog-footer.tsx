"use client";

import Link from "next/link";
import { ArrowUp } from "lucide-react";

interface BlogFooterProps {
  siteName: string;
}

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

interface FooterColumn {
  heading: string;
  links: FooterLink[];
}

const COLUMNS: FooterColumn[] = [
  {
    heading: "内容",
    links: [
      { label: "首页", href: "/" },
      { label: "归档", href: "/archive/all" },
      { label: "搜索", href: "/search" },
    ],
  },
  {
    heading: "资源",
    links: [
      { label: "RSS Feed", href: "/feed.xml" },
      { label: "站点地图", href: "/sitemap.xml" },
      { label: "llms.txt", href: "/llms.txt" },
    ],
  },
];

export function BlogFooter({ siteName }: BlogFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="zed-footer" aria-label="Site footer">
      <div className="zed-footer-cols">
        {/* col 1: brand */}
        <div className="zed-footer-col">
          <p className="zed-footer-heading">{siteName}</p>
          <p style={{ fontFamily: "var(--ff-mono)", fontSize: "0.8125rem", color: "rgba(255,255,255,0.78)", margin: "0.25em 0 1em" }}>
            © {year}
          </p>
          <button
            type="button"
            onClick={() => {
              const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
            }}
            className="zed-footer-list"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4em",
              fontFamily: "var(--ff-mono)",
              fontSize: "0.8125rem",
              color: "rgba(255,255,255,0.78)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
              textDecorationColor: "rgba(255,255,255,0.3)",
              textUnderlineOffset: "3px",
            }}
            aria-label="回到顶部"
          >
            <ArrowUp className="h-3 w-3" strokeWidth={1.5} />
            回到顶部
          </button>
        </div>

        {/* cols 2-5: link groups */}
        {COLUMNS.map((col) => (
          <div className="zed-footer-col" key={col.heading}>
            <p className="zed-footer-heading">{col.heading}</p>
            <ul className="zed-footer-list">
              {col.links.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a href={link.href} target="_blank" rel="noopener noreferrer">
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} prefetch={false}>
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* hatching watermark band */}
      <div className="zed-footer-watermark" aria-hidden="true">
        <span className="zed-footer-watermark-text">{siteName}</span>
      </div>
    </footer>
  );
}
