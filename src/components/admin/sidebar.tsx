"use client";

import { APP_VERSION } from "@/lib/version";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Tags,
  Image,
  LogOut,
  PanelLeft,
  Settings,
  ExternalLink,
  Bot,
  KeyRound,
  Fingerprint,
  CloudUpload,
  Search,
  Activity,
  Users,
  UserRound,
} from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarNav,
  SidebarPartition,
  SidebarFooter,
  SidebarUser,
  SidebarSearch,
} from "@nocoo/basalt";
import { Button } from "@nocoo/basalt/components/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@nocoo/basalt";
import { Avatar, AvatarFallback, AvatarImage } from "@nocoo/basalt";
import { useCommandPalette } from "@/components/admin/command-palette";
import { cn } from "@/lib/utils";

// ── Navigation data model ──

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  external?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "概览",
    items: [
      { title: "仪表盘", href: "/admin", icon: LayoutDashboard },
      { title: "系统监控", href: "/admin/system", icon: Activity },
      { title: "访问站点", href: "/", icon: ExternalLink, external: true },
    ],
  },
  {
    label: "内容",
    items: [
      { title: "文章", href: "/admin/posts", icon: FileText },
      { title: "分类", href: "/admin/categories", icon: FolderOpen },
      { title: "标签", href: "/admin/tags", icon: Tags },
      { title: "媒体库", href: "/admin/media", icon: Image },
    ],
  },
  {
    label: "作者",
    items: [
      { title: "作者", href: "/admin/authors", icon: UserRound },
      { title: "AI 代理", href: "/admin/ai-agents", icon: Users },
    ],
  },
  {
    label: "系统",
    items: [
      { title: "通用设置", href: "/admin/settings", icon: Settings },
      { title: "站点身份", href: "/admin/site-identity", icon: Fingerprint },
      { title: "AI 设置", href: "/admin/ai-settings", icon: Bot },
      { title: "MCP 令牌", href: "/admin/mcp", icon: KeyRound },
      { title: "备份", href: "/admin/backup", icon: CloudUpload },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

// ── Item styling matching Basalt SidebarItem & SidebarIconItem tokens ──

const sidebarIconItemClass = (active: boolean) =>
  cn(
    "relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
    active
      ? "bg-basalt-accent text-basalt-foreground"
      : "text-basalt-muted-foreground hover:bg-basalt-accent hover:text-basalt-foreground",
  );

const sidebarItemClass = (active: boolean) =>
  cn(
    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal transition-colors",
    active
      ? "bg-basalt-accent text-basalt-foreground"
      : "text-basalt-muted-foreground hover:bg-basalt-accent hover:text-basalt-foreground",
  );

// ── Sidebar Component ──

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  user: {
    name?: string | null | undefined;
    email?: string | null | undefined;
    image?: string | null | undefined;
  };
}

export function AdminSidebar({ collapsed, onToggle, user }: AdminSidebarProps) {
  const pathname = usePathname();
  const { setOpen: openSearch } = useCommandPalette();

  const isItemActive = (item: NavItem) => {
    if (item.external) return false;
    if (item.href === "/admin") return pathname === "/admin";
    return pathname.startsWith(item.href);
  };

  const initials = (user.name ?? user.email ?? "A")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const userAvatar = (
    <Avatar className="h-9 w-9 shrink-0">
      {user.image && <AvatarImage src={user.image} alt={user.name ?? "用户"} />}
      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
    </Avatar>
  );

  return (
    <Sidebar collapsed={collapsed}>
      {collapsed ? (
        /* ── Collapsed rail ── */
        <TooltipProvider delayDuration={0}>
          <SidebarHeader className="justify-center px-0">
            <img
              src="/logo-24.png"
              alt="Firefly"
              width={24}
              height={24}
              className="h-6 w-6"
            />
          </SidebarHeader>

          <Button
            variant="ghost"
            size="icon"
            className="mb-1 self-center"
            onClick={onToggle}
            aria-label="展开侧边栏"
          >
            <PanelLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
          </Button>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn("mb-2 self-center", sidebarIconItemClass(false))}
                onClick={() => openSearch(true)}
                aria-label="搜索 (⌘K)"
              >
                <Search className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              搜索 (⌘K)
            </TooltipContent>
          </Tooltip>

          <SidebarNav className="w-full items-center gap-1 pt-1">
            {ALL_NAV_ITEMS.map((item) => {
              const active = isItemActive(item);
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={item.title}
                        className={sidebarIconItemClass(active)}
                      >
                        <item.icon className="h-4 w-4" strokeWidth={1.5} />
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        aria-label={item.title}
                        aria-current={active ? "page" : undefined}
                        className={sidebarIconItemClass(active)}
                      >
                        <item.icon className="h-4 w-4" strokeWidth={1.5} />
                      </Link>
                    )}
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.title}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </SidebarNav>

          <SidebarFooter className="flex w-full justify-center px-0">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-pointer">{userAvatar}</span>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {user.name ?? "管理员"}
              </TooltipContent>
            </Tooltip>
          </SidebarFooter>
        </TooltipProvider>
      ) : (
        /* ── Expanded rail ── */
        <>
          <SidebarHeader>
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/logo-24.png"
                  alt="Firefly"
                  width={24}
                  height={24}
                  className="h-6 w-6"
                />
                <span className="text-lg font-bold tracking-tighter text-basalt-foreground">
                  Firefly
                </span>
                <span className="rounded-md bg-basalt-secondary px-1.5 py-0.5 font-mono text-2xs font-medium text-basalt-muted-foreground leading-none">
                  v{APP_VERSION}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onToggle}
                aria-label="收起侧边栏"
              >
                <PanelLeft
                  className="h-4 w-4"
                  aria-hidden="true"
                  strokeWidth={1.5}
                />
              </Button>
            </div>
          </SidebarHeader>

          <div className="px-3 pb-1">
            <SidebarSearch shortcut="⌘K" onClick={() => openSearch(true)}>
              搜索
            </SidebarSearch>
          </div>

          <SidebarNav className="pt-1">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <SidebarPartition>{group.label}</SidebarPartition>
                <div className="flex flex-col gap-0.5 px-3">
                  {group.items.map((item) => {
                    const active = isItemActive(item);
                    return item.external ? (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={sidebarItemClass(active)}
                      >
                        <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                        <span className="flex-1 truncate text-left">{item.title}</span>
                      </a>
                    ) : (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={sidebarItemClass(active)}
                      >
                        <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                        <span className="flex-1 truncate text-left">{item.title}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </SidebarNav>

          <SidebarFooter>
            <SidebarUser
              avatar={userAvatar}
              name={user.name ?? "管理员"}
              email={user.email}
              action={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  aria-label="退出登录"
                >
                  <LogOut
                    className="h-4 w-4 text-basalt-muted-foreground"
                    aria-hidden="true"
                    strokeWidth={1.5}
                  />
                </Button>
              }
            />
          </SidebarFooter>
        </>
      )}
    </Sidebar>
  );
}
