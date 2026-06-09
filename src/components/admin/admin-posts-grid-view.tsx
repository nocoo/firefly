"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FileX } from "lucide-react";
import type { PostWithCategory } from "@/models/types";
import { PostGridCard } from "@/components/admin/post-grid-card";
import { EmptyState } from "@/components/ui/empty-state";

const GRID_PAGE_SIZE = 36;

export function AdminPostsGridView({
  currentParams,
  selectedIds,
  onToggleSelect,
}: {
  currentParams: Record<string, string | undefined>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  const [posts, setPosts] = useState<PostWithCategory[]>([]);
  const [_page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const fetchPosts = useCallback(
    async (pageNum: number) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);

      try {
        const sp = new URLSearchParams();
        sp.set("page", String(pageNum));
        sp.set("pageSize", String(GRID_PAGE_SIZE));
        if (currentParams.status) sp.set("status", currentParams.status);
        if (currentParams.category) sp.set("category", currentParams.category);
        if (currentParams.tag) sp.set("tag", currentParams.tag);
        if (currentParams.year) sp.set("year", currentParams.year);
        if (currentParams.month) sp.set("month", currentParams.month);

        const res = await fetch(`/api/admin/posts?${sp.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch posts");

        const data = (await res.json()) as {
          posts: PostWithCategory[];
          total: number;
        };

        setPosts((prev) => (pageNum === 1 ? data.posts : [...prev, ...data.posts]));
        setHasMore(pageNum * GRID_PAGE_SIZE < data.total);
      } catch (err) {
        console.error("Failed to load posts:", err);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [currentParams.status, currentParams.category, currentParams.tag, currentParams.year, currentParams.month],
  );

  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
    fetchPosts(1);
  }, [fetchPosts]);

  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          setPage((prev) => {
            const next = prev + 1;
            fetchPosts(next);
            return next;
          });
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, fetchPosts]);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {posts.map((post) => (
          <PostGridCard
            key={post.id}
            post={post}
            selected={selectedIds.has(post.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>

      <div ref={sentinelRef} className="h-1" />

      {loading && (
        <div className="py-4 text-center text-sm text-muted-foreground">
          加载中...
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <div className="py-4 text-center text-sm text-muted-foreground">
          没有更多文章
        </div>
      )}

      {!loading && posts.length === 0 && (
        <EmptyState icon={FileX} message="未找到文章" variant="admin" />
      )}
    </>
  );
}
