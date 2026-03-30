"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/context";
import type { PostWithCategory } from "@/models/types";
import type { PostStatus } from "@/models/types";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: false,
  setOpen: () => {},
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

const STATUS_LABEL_KEYS: Record<PostStatus, string> = {
  draft: "admin.posts.status.draft",
  published: "admin.posts.status.published",
  private: "admin.posts.status.private",
  archived: "admin.posts.status.archived",
};

const STATUS_COLORS: Record<PostStatus, string> = {
  draft:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  published:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  private:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  archived:
    "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

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
  const { t } = useLocale();

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const posts = results?.posts ?? [];

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % Math.max(posts.length, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) =>
          prev <= 0 ? Math.max(posts.length - 1, 0) : prev - 1,
        );
        break;
      case "Enter":
        e.preventDefault();
        if (posts[activeIndex]) {
          navigateToPost(posts[activeIndex].id);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const posts = results?.posts ?? [];
  const snippets = results?.snippets ?? {};
  const hasQuery = query.trim().length > 0;

  return createPortal(
    <div className="fixed inset-0 z-50" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-xs"
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
            placeholder={t("admin.search.placeholder")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-background px-1.5 text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[min(400px,50vh)] overflow-y-auto overscroll-contain"
        >
          {hasQuery && !loading && posts.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t("admin.search.noResults")}
            </div>
          )}

          {posts.length > 0 && (
            <div className="py-1">
              {posts.map((post, index) => (
                <button
                  key={post.id}
                  data-active={index === activeIndex}
                  onClick={() => navigateToPost(post.id)}
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
                        "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none",
                        STATUS_COLORS[post.status as PostStatus] ?? "",
                      )}
                    >
                      {t(
                        STATUS_LABEL_KEYS[post.status as PostStatus] ??
                          post.status,
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {post.category_name && (
                      <span className="truncate">{post.category_name}</span>
                    )}
                    {post.category_name && snippets[post.id] && (
                      <span aria-hidden="true">·</span>
                    )}
                    {snippets[post.id] && (
                      <span
                        className="flex-1 truncate [&>mark]:bg-yellow-200 [&>mark]:text-yellow-900 dark:[&>mark]:bg-yellow-800/40 dark:[&>mark]:text-yellow-200"
                        dangerouslySetInnerHTML={{
                          __html: snippets[post.id],
                        }}
                      />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
