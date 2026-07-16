"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  FileText,
  Tag,
  Folder,
  Image,
  Settings,
  KeyRound,
  Users,
  Activity,
  Database,
  BarChart3,
  Sparkles,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { filterCommandsByQuery } from "@/lib/command-filter";
import type { PostWithCategory } from "@/models/types";
import type { PostStatus } from "@/models/types";
import { STATUS_COLORS } from "@/lib/status-colors";
import { sanitizeSnippet } from "@/lib/sanitize-snippet";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: false,
  setOpen: () => { /* default no-op until provider mounts */ },
});

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}

// ---------------------------------------------------------------------------
// Provider — registers global Cmd+K listener
// ---------------------------------------------------------------------------

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ open, setOpen }}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Status badge styles (matches admin-posts-client)
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<PostStatus, string> = {
  draft: "草稿",
  published: "已发布",
  private: "私密",
  archived: "已归档",
};

// ---------------------------------------------------------------------------
// Navigation commands — page-jump targets always available in the palette.
// Order = display order in the "导航" section. Keywords broaden matching so
// e.g. "media" matches "媒体库", "settings" matches "站点设置".
// ---------------------------------------------------------------------------

interface NavCommand {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  keywords: string[];
}

const NAV_COMMANDS: NavCommand[] = [
  { id: "nav-dashboard", label: "Dashboard", href: "/admin", icon: BarChart3, keywords: ["dashboard", "analytics", "概览", "仪表盘"] },
  { id: "nav-posts", label: "文章", href: "/admin/posts", icon: FileText, keywords: ["posts", "articles", "文章"] },
  { id: "nav-new-post", label: "新建文章", href: "/admin/posts/new", icon: FileText, keywords: ["new", "create", "新建", "撰写"] },
  { id: "nav-media", label: "媒体库", href: "/admin/media", icon: Image, keywords: ["media", "images", "媒体", "图片"] },
  { id: "nav-categories", label: "分类", href: "/admin/categories", icon: Folder, keywords: ["categories", "分类"] },
  { id: "nav-tags", label: "标签", href: "/admin/tags", icon: Tag, keywords: ["tags", "标签"] },
  { id: "nav-site-identity", label: "站点身份", href: "/admin/site-identity", icon: Building2, keywords: ["site", "identity", "branding", "站点", "身份", "品牌"] },
  { id: "nav-settings", label: "设置", href: "/admin/settings", icon: Settings, keywords: ["settings", "preferences", "设置", "偏好"] },
  { id: "nav-ai-agents", label: "AI 代理", href: "/admin/ai-agents", icon: Users, keywords: ["ai", "agents", "代理"] },
  { id: "nav-ai-settings", label: "AI 设置", href: "/admin/ai-settings", icon: Sparkles, keywords: ["ai", "settings", "provider", "ai 设置"] },
  { id: "nav-mcp", label: "MCP 令牌", href: "/admin/mcp", icon: KeyRound, keywords: ["mcp", "tokens", "api keys", "令牌"] },
  { id: "nav-backup", label: "备份", href: "/admin/backup", icon: Database, keywords: ["backup", "restore", "备份"] },
  { id: "nav-system", label: "系统监控", href: "/admin/system", icon: Activity, keywords: ["system", "memory", "monitor", "系统", "监控"] },
];

/**
 * Filter navigation commands against a free-text query. Empty query returns
 * all commands. Match logic lives in `lib/command-filter` so it can be
 * unit-tested independently of the React shell.
 */
function filterNavCommands(query: string): NavCommand[] {
  return filterCommandsByQuery(NAV_COMMANDS, query);
}

// ---------------------------------------------------------------------------
// Search result type
// ---------------------------------------------------------------------------

interface SearchResult {
  posts: PostWithCategory[];
  snippets: Record<string, string>;
  total: number;
}

// ---------------------------------------------------------------------------
// CommandPalette component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const router = useRouter();

  // Reset state when opening/closing
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setActiveIndex(0);
      // Focus input after portal renders
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      // Abort any in-flight request
      abortRef.current?.abort();
    }
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/search?q=${encodeURIComponent(q.trim())}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error("Search failed");
      const data = (await res.json()) as SearchResult;
      setResults(data);
      setActiveIndex(0);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setResults(null);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
    clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const navigateToPost = useCallback(
    (postId: string) => {
      setOpen(false);
      router.push(`/admin/posts/${postId}/edit`);
    },
    [setOpen, router],
  );

  const navigateTo = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [setOpen, router],
  );

  const navCommands = useMemo(() => filterNavCommands(query), [query]);
  const posts = useMemo(() => results?.posts ?? [], [results]);
  const snippets = results?.snippets ?? {};
  const totalItems = navCommands.length + posts.length;

  const handleSelect = useCallback(
    (index: number) => {
      if (index < navCommands.length) {
        navigateTo(navCommands[index].href);
        return;
      }
      const post = posts[index - navCommands.length];
      if (post) navigateToPost(post.id);
    },
    [navCommands, posts, navigateTo, navigateToPost],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % Math.max(totalItems, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) =>
          prev <= 0 ? Math.max(totalItems - 1, 0) : prev - 1,
        );
        break;
      case "Enter":
        e.preventDefault();
        handleSelect(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  // Scroll active item into view when keyboard selection moves. Depends on
  // activeIndex (and open) so the first run after the panel mounts still
  // works — listRef is null while open is false.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    // Touch activeIndex so the dependency is used; DOM marks the row via data-active.
    void activeIndex;
    const active = list.querySelector("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  if (!open) return null;

  const hasQuery = query.trim().length > 0;
  const showNoResults =
    hasQuery && !loading && navCommands.length === 0 && posts.length === 0;

  return createPortal(
    <div className="fixed inset-0 z-50" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-zinc-950/50 backdrop-blur-xs"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div className="absolute inset-x-0 top-[15%] mx-auto flex max-w-[560px] flex-col overflow-hidden rounded-[var(--radius-island)] border border-border bg-card shadow-xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border bg-secondary px-4 py-3">
          {loading ? (
            <Loader2
              className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
              strokeWidth={1.5}
            />
          ) : (
            <Search
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={1.5}
            />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="搜索文章或跳转页面..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-background px-1.5 text-2xs font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[min(400px,50vh)] overflow-y-auto overscroll-contain"
        >
          {showNoResults && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              没有找到结果
            </div>
          )}

          {/* Navigation section */}
          {navCommands.length > 0 && (
            <div className="py-1">
              <div className="px-4 py-1 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                导航
              </div>
              {navCommands.map((cmd, navIndex) => {
                const index = navIndex;
                const Icon = cmd.icon;
                return (
                  <button type="button"
                    key={cmd.id}
                    data-active={index === activeIndex}
                    onClick={() => handleSelect(index)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      "flex w-full items-center gap-2 px-4 py-2 text-left transition-colors",
                      index === activeIndex
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                    )}
                  >
                    <Icon
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate text-sm text-foreground">
                      {cmd.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Posts section */}
          {posts.length > 0 && (
            <div className="py-1">
              <div className="px-4 py-1 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                文章
              </div>
              {posts.map((post, postIndex) => {
                const index = navCommands.length + postIndex;
                return (
                  <button type="button"
                    key={post.id}
                    data-active={index === activeIndex}
                    onClick={() => handleSelect(index)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      "flex w-full flex-col gap-1 px-4 py-2.5 text-left transition-colors",
                      index === activeIndex
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm font-medium text-foreground">
                        {post.title}
                      </span>
                      <span
                        className={cn(
                          "inline-flex shrink-0 rounded-full px-2 py-0.5 text-2xs font-medium leading-none",
                          STATUS_COLORS[post.status as PostStatus] ?? "",
                        )}
                      >
                        {STATUS_LABELS[post.status as PostStatus] ?? post.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {post.category_name && (
                        <span className="truncate">{post.category_name}</span>
                      )}
                      {post.category_name && snippets[post.id] && (
                        <span aria-hidden="true">·</span>
                      )}
                      {snippets[post.id] ? (
                        <span
                          className="flex-1 truncate [&>mark]:bg-yellow-200 [&>mark]:text-yellow-900 dark:[&>mark]:bg-yellow-800/40 dark:[&>mark]:text-yellow-200"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeSnippet(snippets[post.id]),
                          }}
                        />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
