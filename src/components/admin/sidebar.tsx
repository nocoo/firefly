"use client";

import { APP_VERSION } from "@/lib/version";
import { useState } from "react";
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
  ChevronUp,
  Settings,
  ExternalLink,
  Bot,
  KeyRound,
  Fingerprint,
  CloudUpload,
  Search,
  Activity,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { useLocale } from "@/i18n/context";
import { useCommandPalette } from "@/components/admin/command-palette";

// ── Navigation data model ──

interface NavItem {
  titleKey: string;
  href: string;
  icon: React.ElementType;
  external?: boolean;
}

interface NavGroup {
  labelKey: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "admin.nav.overview",
    defaultOpen: true,
    items: [
      { titleKey: "admin.nav.dashboard", href: "/admin", icon: LayoutDashboard },
      { titleKey: "admin.nav.systemMonitor", href: "/admin/system", icon: Activity },
      { titleKey: "admin.sidebar.visitSite", href: "/", icon: ExternalLink, external: true },
    ],
  },
  {
    labelKey: "admin.nav.content",
    defaultOpen: true,
    items: [
      { titleKey: "admin.nav.posts", href: "/admin/posts", icon: FileText },
      { titleKey: "admin.nav.categories", href: "/admin/categories", icon: FolderOpen },
      { titleKey: "admin.nav.tags", href: "/admin/tags", icon: Tags },
      { titleKey: "admin.nav.media", href: "/admin/media", icon: Image },
    ],
  },
  {
    labelKey: "admin.nav.system",
    defaultOpen: true,
    items: [
      { titleKey: "admin.nav.settings", href: "/admin/settings", icon: Settings },
      { titleKey: "admin.nav.siteIdentity", href: "/admin/site-identity", icon: Fingerprint },
      { titleKey: "admin.nav.aiSettings", href: "/admin/ai-settings", icon: Bot },
      { titleKey: "admin.nav.aiAgents", href: "/admin/ai-agents", icon: Users },
      { titleKey: "admin.nav.mcpTokens", href: "/admin/mcp", icon: KeyRound },
      { titleKey: "admin.nav.backup", href: "/admin/backup", icon: CloudUpload },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

// ── Collapsible nav group ──

function NavGroupSection({
  group,
  isActive,
}: {
  group: NavGroup;
  isActive: (href: string) => boolean;
}) {
  const [open, setOpen] = useState(group.defaultOpen ?? true);
  const { t } = useLocale();

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2.5"
      >
        <span className="text-sm font-normal text-muted-foreground">
          {t(group.labelKey)}
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center">
          <ChevronUp
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              !open && "rotate-180",
            )}
            strokeWidth={1.5}
          />
        </span>
      </button>
      <div
        className="grid overflow-hidden"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 200ms ease-out",
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const className = cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal transition-colors",
                !item.external && isActive(item.href)
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              );
              return item.external ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                >
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span>{t(item.titleKey)}</span>
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={className}
                >
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span>{t(item.titleKey)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ──

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
  const { t } = useLocale();
  const { setOpen: openSearch } = useCommandPalette();

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const initials = (user.name ?? user.email ?? "A")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col bg-background transition-[width] duration-300 ease-in-out overflow-hidden",
        collapsed ? "w-[68px]" : "w-[260px]",
      )}
    >
      {collapsed ? (
        /* ── Collapsed view ── */
        <div className="flex h-screen w-[68px] flex-col items-center">
          {/* Logo */}
          <div className="flex h-14 items-center justify-center">
            <img
              src="/logo-24.png"
              alt="Firefly"
              width={24}
              height={24}
              className="h-6 w-6"
            />
          </div>

          {/* Expand button */}
          <IconButton
            onClick={onToggle}
            aria-label={t("admin.sidebar.expand")}
            size="lg"
            className="mb-2"
          >
            <PanelLeft
              className="h-4 w-4"
              aria-hidden="true"
              strokeWidth={1.5}
            />
          </IconButton>

          {/* Search */}
          <button
            onClick={() => openSearch(true)}
            title={t("admin.search.trigger")}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Search className="h-4 w-4" strokeWidth={1.5} />
          </button>

          {/* Nav icons */}
          <nav className="flex-1 flex flex-col items-center gap-1 pt-1">
            {ALL_NAV_ITEMS.map((item) => {
              const className = cn(
                "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                !item.external && isActive(item.href)
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              );
              return item.external ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t(item.titleKey)}
                  className={className}
                >
                  <item.icon className="h-4 w-4" strokeWidth={1.5} />
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  title={t(item.titleKey)}
                  className={className}
                >
                  <item.icon className="h-4 w-4" strokeWidth={1.5} />
                </Link>
              );
            })}
          </nav>

          {/* User avatar */}
          <div className="py-3 flex justify-center w-full">
            <Avatar className="h-9 w-9">
              {user.image && <AvatarImage src={user.image} alt={user.name ?? t("admin.sidebar.userFallback")} />}
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      ) : (
        /* ── Expanded view ── */
        <div className="flex h-screen w-[260px] flex-col">
          {/* Header */}
          <div className="px-3 h-14 flex items-center">
            <div className="flex w-full items-center justify-between px-3">
              <div className="flex items-center gap-3">
                <img
                  src="/logo-24.png"
                  alt="Firefly"
                  width={24}
                  height={24}
                  className="h-6 w-6"
                />
                <span className="text-lg font-semibold text-foreground">
                  {t("admin.sidebar.firefly")}
                </span>
                <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground leading-none">
                  v{APP_VERSION}
                </span>
              </div>
              <IconButton
                onClick={onToggle}
                aria-label={t("admin.sidebar.collapse")}
                size="sm"
              >
                <PanelLeft
                  className="h-4 w-4"
                  aria-hidden="true"
                  strokeWidth={1.5}
                />
              </IconButton>
            </div>
          </div>

          {/* Search */}
          <div className="px-3">
            <button
              onClick={() => openSearch(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Search className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span className="flex-1 text-left">{t("admin.search.trigger")}</span>
              <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Navigation — collapsible groups */}
          <nav className="flex-1 overflow-y-auto px-3 pt-1">
            {NAV_GROUPS.map((group) => (
              <NavGroupSection
                key={group.labelKey}
                group={group}
                isActive={isActive}
              />
            ))}
          </nav>

          {/* User footer */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 shrink-0">
                {user.image && <AvatarImage src={user.image} alt={user.name ?? t("admin.sidebar.userFallback")} />}
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.name ?? t("admin.sidebar.adminFallback")}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
              <IconButton
                onClick={() => signOut({ callbackUrl: "/login" })}
                aria-label={t("admin.sidebar.signOut")}
                className="shrink-0"
              >
                <LogOut
                  className="h-4 w-4"
                  aria-hidden="true"
                  strokeWidth={1.5}
                />
              </IconButton>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
