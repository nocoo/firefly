"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Tags,
  BarChart3,
  LogOut,
  PanelLeft,
  Layers,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// ── Navigation data model ──

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    defaultOpen: true,
    items: [
      { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { title: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Content",
    defaultOpen: true,
    items: [
      { title: "Posts", href: "/admin/posts", icon: FileText },
      { title: "Categories", href: "/admin/categories", icon: FolderOpen },
      { title: "Tags", href: "/admin/tags", icon: Tags },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

// ── Collapsible nav group (matches basalt NavGroupSection) ──

function NavGroupSection({
  group,
  isActive,
}: {
  group: NavGroup;
  isActive: (href: string) => boolean;
}) {
  const [open, setOpen] = useState(group.defaultOpen ?? true);

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2.5"
      >
        <span className="text-sm font-normal text-muted-foreground">
          {group.label}
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
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal transition-colors",
                  isActive(item.href)
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span>{item.title}</span>
              </Link>
            ))}
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
        "sticky top-0 flex h-screen shrink-0 flex-col bg-background transition-all duration-300 ease-in-out overflow-hidden",
        collapsed ? "w-[68px]" : "w-[260px]",
      )}
    >
      {collapsed ? (
        /* ── Collapsed view ── */
        <div className="flex h-screen w-[68px] flex-col items-center">
          {/* Logo */}
          <div className="flex h-14 items-center justify-center">
            <Layers
              className="h-5 w-5 text-primary"
              strokeWidth={1.5}
            />
          </div>

          {/* Expand button */}
          <button
            onClick={onToggle}
            aria-label="Expand sidebar"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mb-2"
          >
            <PanelLeft
              className="h-4 w-4"
              aria-hidden="true"
              strokeWidth={1.5}
            />
          </button>

          {/* Nav icons */}
          <nav className="flex-1 flex flex-col items-center gap-1 pt-1">
            {ALL_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                title={item.title}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                  isActive(item.href)
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" strokeWidth={1.5} />
              </Link>
            ))}
          </nav>

          {/* User avatar */}
          <div className="py-3 flex justify-center w-full">
            <Avatar className="h-9 w-9">
              {user.image && <AvatarImage src={user.image} alt={user.name ?? "User"} />}
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
                <Layers
                  className="h-5 w-5 text-primary"
                  strokeWidth={1.5}
                />
                <span className="text-lg font-semibold text-foreground">
                  Firefly
                </span>
                <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground leading-none">
                  v0.1
                </span>
              </div>
              <button
                onClick={onToggle}
                aria-label="Collapse sidebar"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
              >
                <PanelLeft
                  className="h-4 w-4"
                  aria-hidden="true"
                  strokeWidth={1.5}
                />
              </button>
            </div>
          </div>

          {/* Navigation — collapsible groups */}
          <nav className="flex-1 overflow-y-auto px-3 pt-1">
            {NAV_GROUPS.map((group) => (
              <NavGroupSection
                key={group.label}
                group={group}
                isActive={isActive}
              />
            ))}
          </nav>

          {/* User footer */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 shrink-0">
                {user.image && <AvatarImage src={user.image} alt={user.name ?? "User"} />}
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.name ?? "Admin"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                aria-label="Sign out"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
              >
                <LogOut
                  className="h-4 w-4"
                  aria-hidden="true"
                  strokeWidth={1.5}
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
