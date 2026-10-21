"use client";

import { APP_VERSION } from "@/lib/version";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
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
  SidebarItem,
  SidebarIconItem,
  SidebarNav,
  SidebarPartition,
  SidebarGroup,
  SidebarFooter,
  SidebarUser,
  SidebarSearch,
  Button,
  Badge,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@nocoo/basalt";
import { useCommandPalette } from "@/components/admin/command-palette";

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
  const router = useRouter();
  const { setOpen: openSearch } = useCommandPalette();

  const isItemActive = (item: NavItem) => {
    if (item.external) return false;
    if (item.href === "/admin") return pathname === "/admin";
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const navigate = (item: NavItem, event: MouseEvent<HTMLButtonElement>) => {
    if (event.type === "auxclick" && event.button !== 1) return;
    if (item.external || event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) {
      window.open(item.href, "_blank", "noopener,noreferrer");
    } else {
      router.push(item.href);
    }
  };

  const renderDestination = (item: NavItem) => {
    const Control = collapsed ? SidebarIconItem : SidebarItem;
    const control = (
      <Control
        key={item.href}
        active={isItemActive(item)}
        aria-label={item.title}
        onClick={(event) => navigate(item, event)}
        onAuxClick={(event) => navigate(item, event)}
      >
        <item.icon size={16} strokeWidth={1.5} aria-hidden="true" />
        {!collapsed && <span>{item.title}</span>}
      </Control>
    );
    return collapsed ? (
      <Tooltip key={item.href}>
        <TooltipTrigger asChild>{control}</TooltipTrigger>
        <TooltipContent side="right">{item.title}</TooltipContent>
      </Tooltip>
    ) : control;
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
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <Sidebar collapsed={collapsed}>
        <SidebarHeader>
          <div className={collapsed
            ? "flex w-full items-center justify-center"
            : "flex w-full items-center justify-between pl-basalt-layout-sm"}
          >
            <div className="flex items-center gap-basalt-space-lg">
              <img src="/logo-80.png" alt="Firefly" width={28} height={28} className="shrink-0" />
              {!collapsed && (
                <>
                  <span className="text-basalt-xl font-semibold">Firefly</span>
                  <Badge variant="secondary">v{APP_VERSION}</Badge>
                </>
              )}
            </div>
            {!collapsed && (
              <Button variant="ghost" size="icon" onClick={onToggle} aria-label="收起侧边栏">
                <PanelLeft size={16} strokeWidth={1.5} aria-hidden="true" />
              </Button>
            )}
          </div>
        </SidebarHeader>
        {collapsed ? (
          <Button
            variant="ghost"
            size="icon"
            className="mb-basalt-space-sm self-center"
            onClick={onToggle}
            aria-label="展开侧边栏"
          >
            <PanelLeft size={16} strokeWidth={1.5} aria-hidden="true" />
          </Button>
        ) : (
          <div className="px-basalt-nav-inset">
            <SidebarSearch shortcut="⌘K" onClick={() => openSearch(true)}>
              搜索
            </SidebarSearch>
          </div>
        )}
        <SidebarNav aria-label="管理导航">
          {collapsed ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarIconItem onClick={() => openSearch(true)} aria-label="搜索 (⌘K)">
                    <Search size={16} strokeWidth={1.5} aria-hidden="true" />
                  </SidebarIconItem>
                </TooltipTrigger>
                <TooltipContent side="right">搜索 (⌘K)</TooltipContent>
              </Tooltip>
              {ALL_NAV_ITEMS.map(renderDestination)}
            </>
          ) : (
            <>
              <SidebarPartition>管理</SidebarPartition>
              {NAV_GROUPS.map((group) => (
                <SidebarGroup key={group.label} label={group.label}>
                  {group.items.map(renderDestination)}
                </SidebarGroup>
              ))}
            </>
          )}
        </SidebarNav>
        <SidebarFooter>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>{userAvatar}</TooltipTrigger>
              <TooltipContent side="right">{user.name ?? "管理员"}</TooltipContent>
            </Tooltip>
          ) : (
            <SidebarUser
              avatar={userAvatar}
              name={user.name ?? "管理员"}
              email={user.email}
              action={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  aria-label="退出登录"
                >
                  <LogOut size={16} strokeWidth={1.5} aria-hidden="true" />
                </Button>
              }
            />
          )}
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}
