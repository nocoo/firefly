"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Github } from "@/components/icons/brand";
import { cn } from "@/lib/utils";
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile";
import { AdminSidebar } from "@/components/admin/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { IconButton } from "@/components/ui/icon-button";
import { Toaster } from "@/components/ui/sonner";
import { PageSubtitleProvider, usePageSubtitle } from "@/components/admin/page-subtitle-context";
import {
  CommandPaletteProvider,
  CommandPalette,
} from "@/components/admin/command-palette";

// Map admin routes to page titles
const PAGE_TITLES: Record<string, string> = {
  "/admin": "仪表盘",
  "/admin/posts": "文章",
  "/admin/categories": "分类",
  "/admin/tags": "标签",
  "/admin/media": "媒体库",
  "/admin/site-identity": "站点身份",
  "/admin/settings": "通用设置",
  "/admin/ai-settings": "AI 设置",
  "/admin/ai-agents": "AI 代理",
  "/admin/mcp": "MCP 令牌",
  "/admin/backup": "备份管理",
  "/admin/system": "系统监控",
};

interface AdminShellProps {
  user: {
    name?: string | null | undefined;
    email?: string | null | undefined;
    image?: string | null | undefined;
  };
  children: React.ReactNode;
}

export function AdminShell({ user, children }: AdminShellProps) {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [collapsed, setCollapsed] = useState(isTablet);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Auto-collapse once when entering tablet range; user toggle still works.
  // Uses a ref to track previous isTablet so we only fire on the transition.
  const wasTablet = useRef(isTablet);
  useEffect(() => {
    if (isTablet && !wasTablet.current) {
      setCollapsed(true);
    }
    wasTablet.current = isTablet;
  }, [isTablet]);

  // Resolve page title from pathname
  const title =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES).find(([key]) =>
      key !== "/admin" && pathname.startsWith(key),
    )?.[1] ??
    "管理";

  // Close mobile sidebar on route change — intentional setState in effect
  // to sync UI with navigation (external event from Next.js router).
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      setMobileOpen(false);
    }
  }, [pathname]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Escape key to close + focus trap inside mobile sidebar
  useEffect(() => {
    if (!mobileOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setMobileOpen(false);
        hamburgerRef.current?.focus();
        return;
      }

      if (e.key === "Tab" && sidebarRef.current) {
        const focusable = sidebarRef.current.querySelectorAll<HTMLElement>(
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
  }, [mobileOpen]);

  // Move focus into sidebar on open
  useEffect(() => {
    if (mobileOpen && sidebarRef.current) {
      const first = sidebarRef.current.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      first?.focus();
    }
  }, [mobileOpen]);

  // Set inert on background content when mobile sidebar is open
  useEffect(() => {
    if (mainRef.current) {
      if (mobileOpen) {
        mainRef.current.setAttribute("inert", "");
      } else {
        mainRef.current.removeAttribute("inert");
      }
    }
  }, [mobileOpen]);

  return (
    <CommandPaletteProvider>
      <PageSubtitleProvider>
        <div className="flex min-h-screen w-full bg-background">
          {/* Desktop sidebar */}
          {!isMobile && (
            <AdminSidebar
              collapsed={collapsed}
              onToggle={() => setCollapsed(!collapsed)}
              user={user}
            />
          )}

          {/* Mobile overlay */}
          {isMobile && mobileOpen && (
            <div
              ref={sidebarRef}
              role="dialog"
              aria-modal="true"
              aria-label="打开导航"
              className="fixed inset-0 z-40"
            >
              <div
                className="absolute inset-0 bg-zinc-950/50 backdrop-blur-xs"
                role="presentation"
                onClick={closeMobile}
              />
              <div className="absolute inset-y-0 left-0 z-50 w-[var(--sidebar-width)]">
                <AdminSidebar
                  collapsed={false}
                  onToggle={closeMobile}
                  user={user}
                />
              </div>
            </div>
          )}

          {/* Main content */}
          <div ref={mainRef} className="flex-1 flex flex-col min-h-screen min-w-0">
            {/* Top bar */}
            <ShellHeader
              title={title}
              isMobile={isMobile}
              onOpenMobile={() => setMobileOpen(true)}
              openNavLabel="打开导航"
              hamburgerRef={hamburgerRef}
            />

            {/* Page content */}
            <div className={cn("flex-1 px-2 pb-2 md:px-3 md:pb-3")}>
              <div className="h-full rounded-[var(--radius-island)] bg-card p-3 md:p-5 overflow-y-auto">
                {children}
              </div>
            </div>
          </div>

          {/* Global toast notifications */}
          <Toaster />

          {/* Global command palette */}
          <CommandPalette />
        </div>
      </PageSubtitleProvider>
    </CommandPaletteProvider>
  );
}

// Extracted header so it can consume PageSubtitleContext
function ShellHeader({
  title,
  isMobile,
  onOpenMobile,
  openNavLabel,
  hamburgerRef,
}: {
  title: string;
  isMobile: boolean;
  onOpenMobile: () => void;
  openNavLabel: string;
  hamburgerRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const { subtitle } = usePageSubtitle();

  return (
    <header className="flex h-14 items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3">
        {isMobile && (
          <IconButton ref={hamburgerRef} onClick={onOpenMobile} aria-label={openNavLabel}>
            <Menu
              className="h-5 w-5"
              aria-hidden="true"
              strokeWidth={1.5}
            />
          </IconButton>
        )}
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg md:text-xl font-semibold text-foreground">
            {title}
          </h1>
          {subtitle && (
            <span className="text-sm text-muted-foreground">{subtitle}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <a
          href="https://github.com/nocoo/firefly"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Github
            className="h-[18px] w-[18px]"
            aria-hidden="true"
            strokeWidth={1.5}
          />
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}
