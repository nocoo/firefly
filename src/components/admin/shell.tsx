"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Github } from "@/components/icons/brand";
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile";
import { AdminSidebar } from "@/components/admin/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";
import {
  PageSubtitleProvider,
  usePageSubtitle,
} from "@/components/admin/page-subtitle-context";
import { t, type TranslationKey } from "@/lib/i18n";
import {
  CommandPaletteProvider,
  CommandPalette,
} from "@/components/admin/command-palette";
import {
  AppShell,
  AppMain,
  AppSkipLink,
} from "@nocoo/basalt/components/app-shell";
import { AppHeader } from "@nocoo/basalt/components/app-header";
import {
  ContentIsland,
  Sheet,
  SheetContent,
  SheetTitle,
  Button,
} from "@nocoo/basalt";

// Map admin routes to dictionary keys. Title strings live in the dictionary
// so they are translatable and share a source of truth with command-palette
// navigation labels.
const PAGE_TITLE_KEYS: Record<string, TranslationKey> = {
  "/admin": "admin.page.dashboard",
  "/admin/posts": "admin.page.posts",
  "/admin/categories": "admin.page.categories",
  "/admin/tags": "admin.page.tags",
  "/admin/media": "admin.page.media",
  "/admin/site-identity": "admin.page.site-identity",
  "/admin/authors": "admin.page.authors",
  "/admin/settings": "admin.page.settings",
  "/admin/ai-settings": "admin.page.ai-settings",
  "/admin/ai-agents": "admin.page.ai-agents",
  "/admin/mcp": "admin.page.mcp",
  "/admin/backup": "admin.page.backup",
  "/admin/system": "admin.page.system",
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
  const titleKey =
    PAGE_TITLE_KEYS[pathname] ??
    Object.entries(PAGE_TITLE_KEYS).find(([key]) =>
      key !== "/admin" && pathname.startsWith(key),
    )?.[1];
  const title = titleKey ? t(titleKey) : "管理";

  // Close mobile sidebar on route change
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

  return (
    <CommandPaletteProvider>
      <PageSubtitleProvider>
        <AppShell>
          <AppSkipLink>跳至主要内容</AppSkipLink>

          {/* Desktop sidebar */}
          {!isMobile && (
            <AdminSidebar
              collapsed={collapsed}
              onToggle={() => setCollapsed(!collapsed)}
              user={user}
            />
          )}

          {/* Mobile Sheet sidebar */}
          {isMobile && (
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetContent
                side="left"
                className="w-[260px] max-w-[260px] border-0 bg-basalt-background p-0"
              >
                <SheetTitle className="sr-only">导航</SheetTitle>
                <AdminSidebar
                  collapsed={false}
                  onToggle={() => setMobileOpen(false)}
                  user={user}
                />
              </SheetContent>
            </Sheet>
          )}

          {/* Main column */}
          <AppMain>
            <ShellHeader
              title={title}
              isMobile={isMobile}
              onOpenMobile={() => setMobileOpen(true)}
            />

            {/* Content island */}
            <div className="flex min-h-0 flex-1 flex-col px-2 pb-2 md:px-3 md:pb-3">
              <ContentIsland>{children}</ContentIsland>
            </div>
          </AppMain>

          {/* Global toast notifications */}
          <Toaster />

          {/* Global command palette */}
          <CommandPalette />
        </AppShell>
      </PageSubtitleProvider>
    </CommandPaletteProvider>
  );
}

// Extracted header consuming AppHeader from basalt
function ShellHeader({
  title,
  isMobile,
  onOpenMobile,
}: {
  title: string;
  isMobile: boolean;
  onOpenMobile: () => void;
}) {
  const { subtitle } = usePageSubtitle();

  const titleStr = subtitle ? `${title} · ${subtitle}` : title;

  const leading = isMobile ? (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={onOpenMobile}
      aria-label="打开导航"
    >
      <Menu className="h-5 w-5" aria-hidden="true" strokeWidth={1.5} />
    </Button>
  ) : null;

  const actions = (
    <div className="flex items-center gap-1.5">
      <a
        href="https://github.com/nocoo/firefly"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-basalt-muted-foreground hover:text-basalt-foreground hover:bg-basalt-accent transition-colors"
      >
        <Github
          className="h-[18px] w-[18px]"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      </a>
      <ThemeToggle />
    </div>
  );

  return (
    <AppHeader
      leading={leading}
      title={titleStr}
      actions={actions}
    />
  );
}
