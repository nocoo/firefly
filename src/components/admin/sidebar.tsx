"use client";

import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";
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
  Link,
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

const SIDEBAR_MARK_SLOT_CLASS = "flex w-full items-center";

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  user: {
    name?: string | null | undefined;
    email?: string | null | undefined;
    image?: string | null | undefined;
  };
}

function NavItemButton({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: (item: NavItem, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <SidebarItem
      active={active}
      aria-label={item.title}
      onClick={(event) => onNavigate(item, event)}
      onAuxClick={(event) => onNavigate(item, event)}
    >
      <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      <span className="flex-1 truncate text-left">{item.title}</span>
      {item.external ? (
        <span className="flex size-basalt-icon-lg shrink-0 items-center justify-center">
          <ExternalLink className="h-3 w-3 text-basalt-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        </span>
      ) : null}
    </SidebarItem>
  );
}

function NavGroupSection({
  group,
  isItemActive,
  onNavigate,
}: {
  group: NavGroup;
  isItemActive: (item: NavItem) => boolean;
  onNavigate: (item: NavItem, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <SidebarGroup label={group.label}>
      {group.items.map((item) => (
        <NavItemButton
          key={item.href}
          item={item}
          active={isItemActive(item)}
          onNavigate={onNavigate}
        />
      ))}
    </SidebarGroup>
  );
}

function CollapsedNavItem({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: (item: NavItem, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <SidebarIconItem
          active={active}
          aria-label={item.title}
          onClick={(event) => onNavigate(item, event)}
          onAuxClick={(event) => onNavigate(item, event)}
        >
          <item.icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </SidebarIconItem>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.title}
      </TooltipContent>
    </Tooltip>
  );
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

  const initials = (user.name ?? user.email ?? "A")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const userAvatar = (
    <Avatar className={cn("h-9 w-9 shrink-0", collapsed && "cursor-pointer")}>
      {user.image && <AvatarImage src={user.image} alt={user.name ?? "用户"} />}
      <AvatarFallback className="text-basalt-sm">{initials}</AvatarFallback>
    </Avatar>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <Sidebar collapsed={collapsed}>
        <SidebarHeader>
          <div
            className={cn(
              SIDEBAR_MARK_SLOT_CLASS,
              collapsed ? "justify-center" : "justify-between pl-basalt-layout-sm",
            )}
          >
            <Link
              href="/admin"
              aria-label="管理首页"
              className="flex items-center gap-basalt-space-lg text-basalt-foreground no-underline hover:no-underline"
            >
              <img
                src="/logo-80.png"
                alt="Firefly"
                width={28}
                height={28}
                className="h-7 w-7 shrink-0 object-contain"
              />
              {collapsed ? null : (
                <>
                  <span className="text-basalt-xl font-semibold text-basalt-foreground">Firefly</span>
                  <span className="rounded-basalt-md bg-basalt-secondary px-basalt-space-md py-basalt-space-xs text-basalt-sm leading-basalt-tight font-medium text-basalt-muted-foreground">
                    v{APP_VERSION}
                  </span>
                </>
              )}
            </Link>
            {collapsed ? null : (
              <Button variant="ghost" size="icon" onClick={onToggle} aria-label="收起侧边栏">
                <PanelLeft aria-hidden="true" />
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
            <PanelLeft aria-hidden="true" />
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
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <SidebarIconItem onClick={() => openSearch(true)} aria-label="搜索 (⌘K)">
                    <Search className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  </SidebarIconItem>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  搜索 (⌘K)
                </TooltipContent>
              </Tooltip>
              {ALL_NAV_ITEMS.map((item) => (
                <CollapsedNavItem
                  key={item.href}
                  item={item}
                  active={isItemActive(item)}
                  onNavigate={navigate}
                />
              ))}
            </>
          ) : (
            <>
              <SidebarPartition>管理</SidebarPartition>
              {NAV_GROUPS.map((group) => (
                <NavGroupSection
                  key={group.label}
                  group={group}
                  isItemActive={isItemActive}
                  onNavigate={navigate}
                />
              ))}
            </>
          )}
        </SidebarNav>
        <SidebarFooter>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>{userAvatar}</TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {user.name ?? "管理员"}
              </TooltipContent>
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
                  <LogOut aria-hidden="true" />
                </Button>
              }
            />
          )}
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}
