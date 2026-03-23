"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export function BlogSidebar() {
  return (
    <aside className="blog-sidebar">
      <div className="blog-sidebar-inner">
        {/* Site identity */}
        <div className="blog-site-title">
          <Link href="/">LIZHENG.ME</Link>
        </div>
        <p className="blog-tagline">知白守黑，不语万千算</p>

        {/* Theme toggle */}
        <div className="mt-6">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
