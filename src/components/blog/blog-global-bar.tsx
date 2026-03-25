"use client";

import { Github } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

interface BlogGlobalBarProps {
  githubUrl: string | null;
}

/**
 * Fixed top-right global bar with optional GitHub link + theme toggle.
 * Floats above all blog content on every page.
 */
export function BlogGlobalBar({ githubUrl }: BlogGlobalBarProps) {
  return (
    <div className="blog-global-bar">
      {githubUrl && (
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="blog-global-bar-link"
          aria-label="GitHub"
        >
          <Github className="h-4 w-4" strokeWidth={1.5} />
        </a>
      )}
      <ThemeToggle />
    </div>
  );
}
