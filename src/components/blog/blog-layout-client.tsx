"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Category, Tag } from "@/models/types";
import type { MonthlyArchive } from "@/data/entities/post";
import type { SocialLink } from "@/data/settings";
import type { Locale } from "@/i18n/translations";
import { BlogSidebar } from "./blog-sidebar";
import { BlogFooter } from "./blog-footer";
import { Menu } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";

const DESKTOP_QUERY = "(min-width: 1200px)";

interface BlogLayoutClientProps {
  categories: Category[];
  tags: Tag[];
  archives: MonthlyArchive[];
  locale: Locale;
  siteName: string;
  siteTagline: string;
  socialLinks: SocialLink[];
  children: React.ReactNode;
}

export function BlogLayoutClient({
  categories, tags, archives, locale, siteName, siteTagline, socialLinks, children,
}: BlogLayoutClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // State convergence: auto-close drawer when entering desktop layout.
  // This is not a layout decision — CSS already hides the drawer at >= 1200px.
  // This cleans up React state so backdrop and scroll-lock don't leak.
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setDrawerOpen(false);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Scroll lock — single owner
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  // Escape key to close + focus trap inside drawer
  useEffect(() => {
    if (!drawerOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setDrawerOpen(false);
        hamburgerRef.current?.focus();
        return;
      }

      if (e.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen]);

  // Move focus into drawer on open, return to hamburger on close
  useEffect(() => {
    if (drawerOpen) {
      // Focus the close button inside the drawer
      const close = drawerRef.current?.querySelector<HTMLElement>(".blog-sidebar-close");
      close?.focus();
    }
  }, [drawerOpen]);

  return (
    <>
      {/* Desktop sidebar — always in DOM, CSS shows/hides via media query */}
      <BlogSidebar
        variant="desktop"
        categories={categories}
        tags={tags}
        archives={archives}
        siteName={siteName}
        siteTagline={siteTagline}
        socialLinks={socialLinks}
      />

      {/* Hamburger — always in DOM, CSS shows/hides via media query */}
      <div className="blog-mobile-bar">
        <IconButton ref={hamburgerRef} onClick={() => setDrawerOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </IconButton>
      </div>

      {/* Drawer backdrop — click to close, not a semantic button */}
      {drawerOpen && (
        <div
          className="blog-sidebar-backdrop"
          onClick={closeDrawer}
        />
      )}

      {/* Drawer sidebar — always in DOM, CSS + inert control visibility */}
      <BlogSidebar
        ref={drawerRef}
        variant="drawer"
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          hamburgerRef.current?.focus();
        }}
        categories={categories}
        tags={tags}
        archives={archives}
        siteName={siteName}
        siteTagline={siteTagline}
        socialLinks={socialLinks}
      />

      <main id="main" className="blog-main">
        {children}
        <BlogFooter locale={locale} siteName={siteName} />
      </main>
    </>
  );
}
