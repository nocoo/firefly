"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Menu, Github } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { AdminSidebar } from "@/components/admin/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

// Map admin routes to page titles
const PAGE_TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/posts": "Posts",
  "/admin/categories": "Categories",
  "/admin/tags": "Tags",
  "/admin/analytics": "Analytics",
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
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Resolve page title from pathname
  const title =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES).find(([key]) =>
      key !== "/admin" && pathname.startsWith(key),
    )?.[1] ??
    "Admin";

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
        <header className="flex h-14 items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Menu
                  className="h-5 w-5"
                  aria-hidden="true"
                  strokeWidth={1.5}
                />
              </button>
            )}
            <h1 className="text-lg md:text-xl font-semibold text-foreground">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-1">
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

        {/* Page content */}
        <div className={cn("flex-1 px-2 pb-2 md:px-3 md:pb-3")}>
          <div className="h-full rounded-[16px] md:rounded-[20px] bg-card p-3 md:p-5 overflow-y-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
