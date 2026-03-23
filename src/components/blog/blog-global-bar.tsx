"use client";

import { Github } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Fixed top-right global bar with GitHub link + theme toggle.
 * Floats above all blog content on every page.
 */
export function BlogGlobalBar() {
  return (
    <div className="blog-global-bar">
      <a
        href="https://github.com/nocoo"
        target="_blank"
        rel="noopener noreferrer"
        className="blog-global-bar-link"
        aria-label="GitHub"
      >
        <Github className="h-4 w-4" strokeWidth={1.5} />
      </a>
      <ThemeToggle />
    </div>
  );
}
