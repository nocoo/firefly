"use client";

import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

interface BlogGlobalBarProps {
  isAdmin: boolean;
}

/**
 * Fixed top-right global bar with optional admin dashboard link + theme toggle.
 * Floats above all blog content on every page.
 */
export function BlogGlobalBar({ isAdmin }: BlogGlobalBarProps) {
  return (
    <div className="blog-global-bar">
      {isAdmin && (
        <Link
          href="/admin"
          className="blog-global-bar-link"
          aria-label="Dashboard"
        >
          <LayoutDashboard className="h-4 w-4" strokeWidth={1.5} />
        </Link>
      )}
      <ThemeToggle />
    </div>
  );
}
