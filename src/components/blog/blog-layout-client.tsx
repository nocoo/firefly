"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { Category, Tag } from "@/models/types";
import type { MonthlyArchive } from "@/data/entities/post";
import type { SocialLink } from "@/data/settings";
import { BlogSidebar } from "./blog-sidebar";

interface BlogLayoutClientProps {
  categories: Category[];
  tags: Tag[];
  archives: MonthlyArchive[];
  siteName: string;
  siteTagline: string;
  socialLinks: SocialLink[];
  children: React.ReactNode;
}

function isPostDetailRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return /^\/\d{4}\/\d{2}\/[^/]+$/.test(pathname) || pathname.startsWith("/preview/");
}

const MOBILE_QUERY = "(max-width: 768px)";
const FOCUSABLE_SEL = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function subscribeMobile(callback: () => void): () => void {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}
function getMobileSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}
function getMobileServerSnapshot(): boolean {
  return false;
}

export function BlogLayoutClient({
  categories, tags, archives, siteName, siteTagline, socialLinks, children,
}: BlogLayoutClientProps) {
  const pathname = usePathname();
  const isPostDetail = isPostDetailRoute(pathname);

  const isMobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, getMobileServerSnapshot);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [trackedPath, setTrackedPath] = useState(pathname);
  if (trackedPath !== pathname) {
    setTrackedPath(pathname);
    if (drawerOpen) setDrawerOpen(false);
  }
  if (!isMobile && drawerOpen) {
    setDrawerOpen(false);
  }

  const sidebarRef = useRef<HTMLElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);

  // While drawer is open: lock body scroll, Escape to close, focus into
  // sidebar, restore focus on close, trap Tab inside sidebar, and mark
  // every page-chrome sibling outside the dialog ancestry as inert so
  // AT/virtual-cursor users can't reach skip-link, global bar, or footer.
  useEffect(() => {
    if (!drawerOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const sidebar = sidebarRef.current;
    const toggle = toggleRef.current;

    // Inert everything in <body> that doesn't contain the sidebar.
    // Skip the backdrop and toggle button — both must remain interactive
    // so the user can dismiss the drawer.
    const inerted: { el: HTMLElement; prevInert: boolean; prevAriaHidden: string | null }[] = [];
    if (sidebar) {
      const ancestors = new Set<Node>();
      for (let n: Node | null = sidebar; n; n = n.parentNode) ancestors.add(n);
      const backdrop = backdropRef.current;
      const walk = (parent: HTMLElement) => {
        for (const child of Array.from(parent.children)) {
          if (!(child instanceof HTMLElement)) continue;
          if (child === sidebar) continue;
          if (child === backdrop) continue;
          if (child === toggle) continue;
          if (ancestors.has(child)) {
            walk(child);
            continue;
          }
          inerted.push({
            el: child,
            prevInert: child.inert,
            prevAriaHidden: child.getAttribute("aria-hidden"),
          });
          child.inert = true;
          child.setAttribute("aria-hidden", "true");
        }
      };
      walk(document.body);
    }

    // Move focus into the drawer
    const firstFocusable = sidebar?.querySelector<HTMLElement>(FOCUSABLE_SEL);
    (firstFocusable ?? sidebar)?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setDrawerOpen(false);
        return;
      }
      if (e.key !== "Tab" || !sidebar) return;
      const items = Array.from(sidebar.querySelectorAll<HTMLElement>(FOCUSABLE_SEL))
        .filter((el) => el.offsetParent !== null || el === sidebar);
      if (items.length === 0) {
        e.preventDefault();
        sidebar.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !sidebar.contains(active))) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && (active === last || !sidebar.contains(active))) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      for (const { el, prevInert, prevAriaHidden } of inerted) {
        el.inert = prevInert;
        if (prevAriaHidden === null) el.removeAttribute("aria-hidden");
        else el.setAttribute("aria-hidden", prevAriaHidden);
      }
      // Restore focus to the trigger if focus is still inside the (now-closed) drawer
      if (sidebar?.contains(document.activeElement)) {
        (toggle ?? previouslyFocused)?.focus({ preventScroll: true });
      } else if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [drawerOpen]);

  // <main> still gets the static inert/aria-hidden as a defense-in-depth
  // (covers the brief gap before the effect runs).
  const mainInert = isMobile && drawerOpen;

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="blog-sidebar-toggle"
        aria-label={drawerOpen ? "关闭侧边栏" : "打开侧边栏"}
        aria-expanded={drawerOpen}
        aria-controls="blog-sidebar"
        onClick={() => setDrawerOpen((v) => !v)}
      >
        {drawerOpen ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Menu className="h-5 w-5" strokeWidth={1.5} />}
      </button>

      {drawerOpen && (
        <div
          ref={backdropRef}
          className="blog-sidebar-backdrop"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <BlogSidebar
        ref={sidebarRef}
        categories={categories}
        tags={tags}
        archives={archives}
        siteName={siteName}
        siteTagline={siteTagline}
        socialLinks={socialLinks}
        drawerOpen={drawerOpen}
        isMobile={isMobile}
        onDrawerClose={() => setDrawerOpen(false)}
      />

      <main
        id="main"
        className="blog-main"
        inert={mainInert || undefined}
        aria-hidden={mainInert ? true : undefined}
      >
        <div className={`blog-main-inner${isPostDetail ? " blog-main-inner-post" : ""}`}>
          {children}
        </div>
      </main>
    </>
  );
}
