"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Menu, Github } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile";
import { AdminSidebar } from "@/components/admin/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { IconButton } from "@/components/ui/icon-button";
import { Toaster } from "@/components/ui/sonner";
import { useLocale } from "@/i18n/context";
import { PageSubtitleProvider, usePageSubtitle } from "@/components/admin/page-subtitle-context";
import {
  CommandPaletteProvider,
  CommandPalette,
} from "@/components/admin/command-palette";

// Map admin routes to i18n title keys
const PAGE_TITLE_KEYS: Record<string, string> = {
  "/admin": "admin.nav.dashboard",
  "/admin/posts": "admin.nav.posts",
  "/admin/categories": "admin.nav.categories",
  "/admin/tags": "admin.nav.tags",
  "/admin/media": "admin.nav.media",
  "/admin/site-identity": "admin.nav.siteIdentity",
  "/admin/settings": "admin.nav.settings",
  "/admin/ai-settings": "admin.nav.aiSettings",
  "/admin/mcp": "admin.nav.mcpTokens",
  "/admin/backup": "admin.backup.title",
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
  const pathname = usePathname();
  const { t } = useLocale();

  // Auto-collapse once when entering tablet range; user toggle still works.
  // Uses a ref to track previous isTablet so we only fire on the transition.
  const wasTablet = useRef(isTablet);
  useEffect(() => {
    if (isTablet && !wasTablet.current) {
      setCollapsed(true); // eslint-disable-line react-hooks/set-state-in-effect
    }
    wasTablet.current = isTablet;
  }, [isTablet]);

  // Resolve page title from pathname
  const titleKey =
    PAGE_TITLE_KEYS[pathname] ??
    Object.entries(PAGE_TITLE_KEYS).find(([key]) =>
      key !== "/admin" && pathname.startsWith(key),
    )?.[1] ??
    "admin.pageTitle.admin";
  const title = t(titleKey);

  // Close mobile sidebar on route change — intentional setState in effect
  // to sync UI with navigation (external event from Next.js router).
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      setMobileOpen(false); // eslint-disable-line react-hooks/set-state-in-effect
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
            <>
              <div
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs"
                onClick={() => setMobileOpen(false)}
              />
              <div className="fixed inset-y-0 left-0 z-50 w-[260px]">
                <AdminSidebar
                  collapsed={false}
                  onToggle={() => setMobileOpen(false)}
                  user={user}
                />
              </div>
            </>
          )}

          {/* Main content */}
          <main className="flex-1 flex flex-col min-h-screen min-w-0">
            {/* Top bar */}
            <ShellHeader
              title={title}
              isMobile={isMobile}
              onOpenMobile={() => setMobileOpen(true)}
              openNavLabel={t("admin.sidebar.openNav")}
            />

            {/* Page content */}
            <div className={cn("flex-1 px-2 pb-2 md:px-3 md:pb-3")}>
              <div className="h-full rounded-[var(--radius-island)] bg-card p-3 md:p-5 overflow-y-auto">
                {children}
              </div>
            </div>
          </main>

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
}: {
  title: string;
  isMobile: boolean;
  onOpenMobile: () => void;
  openNavLabel: string;
}) {
  const { subtitle } = usePageSubtitle();

  return (
    <header className="flex h-14 items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3">
        {isMobile && (
          <IconButton onClick={onOpenMobile} aria-label={openNavLabel}>
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
