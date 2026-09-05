"use client";

import Link from "next/link";
import { ArrowUp } from "lucide-react";
import { JournalBrand } from "./journal-brand";

const COLUMNS = [
  { heading: "THE JOURNAL", links: [
    { label: "最近文章", href: "/" },
    { label: "文章归档", href: "/archive" },
    { label: "搜索", href: "/search" },
  ] },
  { heading: "ELSEWHERE", links: [
    { label: "Play ↗", href: "https://lizheng.me/" },
    { label: "Résumé ↗", href: "https://lizheng.dev/" },
  ] },
  { heading: "KEEP IN TOUCH", links: [
    { label: "RSS", href: "/feed.xml" },
    { label: "站点地图", href: "/sitemap.xml" },
    { label: "llms.txt", href: "/llms.txt" },
  ] },
];

export function BlogFooter({ siteName }: { siteName: string }) {
  return (
    <footer className="journal-footer" aria-label="Site footer">
      <div className="journal-footer-top">
        <div lang="en">
          <p className="journal-eyebrow"><span /> THE STORY CONTINUES</p>
          <h2>Always another chapter<span>.</span></h2>
        </div>
        <a className="journal-footer-play" href="https://lizheng.me/" lang="en">
          <img src="/journal-capsule.svg" width={24} height={27} alt="" aria-hidden="true" />
          Play a little <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className="journal-footer-body">
        <div className="journal-footer-identity">
          <JournalBrand siteName={siteName} />
          <p lang="en">© {new Date().getFullYear()} {siteName}</p>
          <small className="journal-footer-version">v{process.env.NEXT_PUBLIC_APP_VERSION}</small>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.heading}>
            <p className="journal-footer-heading" lang="en">{column.heading}</p>
            <ul className="journal-footer-list">
              {column.links.map((link) => (
                <li key={link.href}>
                  {link.href.startsWith("https:") || /\.(xml|txt)$/.test(link.href) ? (
                    <a href={link.href}>{link.label}</a>
                  ) : (
                    <Link href={link.href} prefetch={false}>{link.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="journal-footer-bottom">
        <span className="journal-location" lang="en"><i aria-hidden="true" /> MADE IN BEIJING</span>
        <span lang="en">BUILT WITH CURIOSITY.</span>
        <button
          type="button"
          className="journal-back-top"
          onClick={() => window.scrollTo({
            top: 0,
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          })}
        >
          返回顶部 <ArrowUp aria-hidden="true" strokeWidth={1.5} />
        </button>
      </div>
    </footer>
  );
}
