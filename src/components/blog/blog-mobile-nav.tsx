"use client";

import { Menu, X } from "lucide-react";
import { useLocale } from "@/i18n/context";

interface BlogMobileNavProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function BlogMobileNav({ isOpen, onToggle }: BlogMobileNavProps) {
  const { t } = useLocale();

  return (
    <div className="blog-mobile-nav">
      <button
        onClick={onToggle}
        className="blog-mobile-nav-button"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
      >
        {isOpen ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Menu className="h-5 w-5" strokeWidth={1.5} />}
      </button>
    </div>
  );
}
