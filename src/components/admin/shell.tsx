"use client";

import { useState, useEffect, useRef, useId } from "react";
import { usePathname } from "next/navigation";
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile";
import { AdminSidebar } from "@/components/admin/sidebar";
import { Toaster } from "@/components/ui/sonner";
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
import {
  AppHeader,
  AppHeaderMenuButton,
  ProjectLinks,
} from "@nocoo/basalt/components/app-header";
import {
  ContentIsland,
  SidebarDrawer,
  SidebarProvider,
  ThemeToggle,
} from "@nocoo/basalt";

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

function getAdminBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  if (pathname === "/admin") {
    return [];
  }

  const items: { label: string; href?: string }[] = [{ label: "概览", href: "/admin" }];

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
    items.push({ label: "AI 代理", href: "/admin/ai-agents" });
    return items;
  }

  return items;
}

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
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileSheetId = useId();

  const wasTablet = useRef(isTablet);
  useEffect(() => {
    if (isTablet && !wasTablet.current) {
      setCollapsed(true);
    }
    wasTablet.current = isTablet;
  }, [isTablet]);

  const title = getAdminPageTitle(pathname);

  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      setMobileOpen(false);
    }
  }, [pathname]);

  return (
    <LinkProvider render={Link}>
      <CommandPaletteProvider>
        <AppShell>
          <AppSkipLink>跳至主要内容</AppSkipLink>

          {!isMobile ? (
            <SidebarProvider collapsed={collapsed} onCollapsedChange={setCollapsed}>
              <AdminSidebar user={user} />
            </SidebarProvider>
          ) : null}

          <SidebarDrawer
            id={mobileSheetId}
            open={mobileOpen}
            onOpenChange={setMobileOpen}
            returnFocusRef={mobileTriggerRef}
            title="导航"
            description="管理后台导航链接与操作"
          >
            <AdminSidebar
              resizable={false}
              user={user}
              onMobileDismiss={() => setMobileOpen(false)}
            />
          </SidebarDrawer>

          <AppMain>
            <AppHeader
              leading={
                isMobile ? (
                  <AppHeaderMenuButton
                    ref={mobileTriggerRef}
                    label="打开导航"
                    aria-controls={mobileSheetId}
                    onClick={() => setMobileOpen(true)}
                  />
                ) : null
              }
              breadcrumbsLabel="面包屑导航"
              breadcrumbs={getAdminBreadcrumbs(pathname)}
              title={title}
              actions={<ShellHeaderActions />}
            />

            <div className="flex min-h-0 flex-1 flex-col px-basalt-space-lg pb-basalt-space-lg md:px-basalt-layout-sm md:pb-basalt-layout-sm">
              <ContentIsland>{children}</ContentIsland>
            </div>
          </AppMain>

          <Toaster />
          <CommandPalette />
        </AppShell>
      </CommandPaletteProvider>
    </LinkProvider>
  );
}

function ShellHeaderActions() {
  return (
    <>
      <ProjectLinks
        github="nocoo/firefly"
        hexly="firefly"
        name="Firefly"
        githubLabel="GitHub 仓库"
        hexlyLabel="Firefly on hexly.ai"
        newTabLabel="（在新标签页中打开）"
      />
      <ThemeToggle
        labels={{
          light: `${t("theme.toggle.tip.next")}：${t("theme.toggle.label.light")}`,
          dark: `${t("theme.toggle.tip.next")}：${t("theme.toggle.label.dark")}`,
          system: `${t("theme.toggle.tip.next")}：${t("theme.toggle.label.system")}`,
        }}
      />
    </>
  );
}
