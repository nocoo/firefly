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
  Settings,
  ExternalLink,
  Bot,
  KeyRound,
  Fingerprint,
  CloudUpload,
  Activity,
  Users,
  UserRound,
} from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarBrand,
  SidebarToggle,
  SidebarItem,
  SidebarIconItem,
  SidebarNav,
  SidebarPartition,
  SidebarGroup,
  SidebarFooter,
  SidebarUser,
  SidebarSearch,
  Link,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@nocoo/basalt";
import { useSidebar } from "@nocoo/basalt/components/sidebar";
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
  resizable?: boolean;
  /** When set, brand toggle dismisses the mobile drawer instead of collapsing the rail. */
  onMobileDismiss?: () => void;
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
        <ExternalLink
          className="h-3 w-3 shrink-0 text-basalt-muted-foreground"
          strokeWidth={1.5}
          aria-hidden="true"
        />
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

function AdminSidebarNav({
  isItemActive,
  onNavigate,
}: {
  isItemActive: (item: NavItem) => boolean;
  onNavigate: (item: NavItem, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { collapsed, peeking } = useSidebar();
  const { setOpen: openSearch } = useCommandPalette();
  const railCollapsed = collapsed && !peeking;

  if (railCollapsed) {
    return (
      <SidebarNav aria-label="管理导航">
        <SidebarSearch shortcut="⌘K" onClick={() => openSearch(true)} aria-label="搜索 (⌘K)">
          搜索
        </SidebarSearch>
        {ALL_NAV_ITEMS.map((item) => (
          <CollapsedNavItem
            key={item.href}
            item={item}
            active={isItemActive(item)}
            onNavigate={onNavigate}
          />
        ))}
      </SidebarNav>
    );
  }

  return (
    <SidebarNav aria-label="管理导航">
      <SidebarSearch shortcut="⌘K" onClick={() => openSearch(true)}>
        搜索
      </SidebarSearch>
      <SidebarPartition>管理</SidebarPartition>
      {NAV_GROUPS.map((group) => (
        <NavGroupSection
          key={group.label}
          group={group}
          isItemActive={isItemActive}
          onNavigate={onNavigate}
        />
      ))}
    </SidebarNav>
  );
}

export function AdminSidebar({ resizable = true, onMobileDismiss, user }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

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
    <Avatar>
      {user.image && <AvatarImage src={user.image} alt={user.name ?? "用户"} />}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );

  const brandAction = onMobileDismiss ? (
    <SidebarToggle
      mode="dismiss"
      onDismiss={onMobileDismiss}
      dismissLabel="关闭导航"
    />
  ) : (
    <SidebarToggle expandLabel="展开侧边栏" collapseLabel="收起侧边栏" />
  );

  return (
    <TooltipProvider delayDuration={0}>
      <Sidebar resizable={resizable}>
        <SidebarHeader>
          <SidebarBrand
            logo={
              <Link href="/admin" aria-label="管理首页">
                <img src="/logo-80.png" alt="Firefly" width={24} height={24} />
              </Link>
            }
            name="Firefly"
            version={`v${APP_VERSION}`}
            action={brandAction}
          />
        </SidebarHeader>
        <AdminSidebarNav isItemActive={isItemActive} onNavigate={navigate} />
        <SidebarFooter>
          <SidebarUser
            avatar={userAvatar}
            name={user.name ?? "管理员"}
            email={user.email}
            signOutLabel="退出登录"
            onSignOut={() => signOut({ callbackUrl: "/login" })}
          />
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}
