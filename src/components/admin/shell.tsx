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
import Link from "next/link";
import { LinkProvider } from "@nocoo/basalt/providers/link";
import {
  AppShell,
  AppMain,
  AppSkipLink,
} from "@nocoo/basalt/components/app-shell";
import { AppHeader } from "@nocoo/basalt/components/app-header";
import {
  ContentIsland,
  Sheet,
  SheetTrigger,
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

// Generate hierarchical breadcrumbs for admin routes
function getAdminBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  if (pathname === "/admin") {
    return [];
  }

  const items: { label: string; href?: string }[] = [{ label: "控制台", href: "/admin" }];

  if (pathname === "/admin/posts/new") {
    items.push({ label: "文章", href: "/admin/posts" });
    return items;
  }
  if (pathname.startsWith("/admin/posts/") && pathname.endsWith("/edit")) {
    items.push({ label: "文章", href: "/admin/posts" });
    return items;
  }
  if (pathname.startsWith("/admin/authors/") && pathname !== "/admin/authors") {
    items.push({ label: "作者", href: "/admin/authors" });
    return items;
  }
  if (pathname.startsWith("/admin/ai-agents/") && pathname !== "/admin/ai-agents") {
    items.push({ label: "AI 代理作者", href: "/admin/ai-agents" });
    return items;
  }

  return items;
}

// Resolve page title for the current route, taking specific sub-routes into account
function getAdminPageTitle(pathname: string): string {
  if (pathname === "/admin/posts/new") return "新建文章";
  if (pathname.startsWith("/admin/posts/") && pathname.endsWith("/edit")) return "编辑文章";
  if (pathname === "/admin/authors/new") return "创建作者";
  if (pathname.startsWith("/admin/authors/") && pathname !== "/admin/authors") return "编辑作者";
  if (pathname === "/admin/ai-agents/new") return "创建代理";
  if (pathname.startsWith("/admin/ai-agents/") && pathname !== "/admin/ai-agents") return "编辑代理";

  const titleKey =
    PAGE_TITLE_KEYS[pathname] ??
    Object.entries(PAGE_TITLE_KEYS).find(([key]) =>
      key !== "/admin" && pathname.startsWith(key),
    )?.[1];

  return titleKey ? t(titleKey) : "管理";
}

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
  const title = getAdminPageTitle(pathname);

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

  const mobileTrigger = (
    <SheetTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label="打开导航"
      >
        <Menu className="h-5 w-5" aria-hidden="true" strokeWidth={1.5} />
      </Button>
    </SheetTrigger>
  );

  return (
    <LinkProvider render={Link}>
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

            {/* Sheet wraps main column always; SheetTrigger only appears on mobile */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <AppMain>
                <ShellHeader
                  title={title}
                  breadcrumbs={getAdminBreadcrumbs(pathname)}
                  leading={isMobile ? mobileTrigger : null}
                />

                {/* Content island */}
                <div className="flex min-h-0 flex-1 flex-col px-2 pb-2 md:px-3 md:pb-3">
                  <ContentIsland>{children}</ContentIsland>
                </div>
              </AppMain>

              {isMobile && (
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
              )}
            </Sheet>

            {/* Global toast notifications */}
            <Toaster />

            {/* Global command palette */}
            <CommandPalette />
          </AppShell>
        </PageSubtitleProvider>
      </CommandPaletteProvider>
    </LinkProvider>
  );
}

// Extracted header consuming AppHeader from basalt
function ShellHeader({
  title,
  breadcrumbs,
  leading,
}: {
  title: string;
  breadcrumbs: { label: string; href?: string }[];
  leading: React.ReactNode;
}) {
  const { subtitle } = usePageSubtitle();

  const titleStr = subtitle ? `${title} · ${subtitle}` : title;

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
      breadcrumbs={breadcrumbs}
      title={titleStr}
      actions={actions}
    />
  );
}
