"use client";

import { Link2 } from "lucide-react";
import { toast } from "sonner";
import type { PostWithCategory, PostStatus } from "@/models/types";
import { postPath } from "@/lib/seo";

/** Build the preview URL for a post (live URL if published, otherwise preview route). */
export function getPreviewUrl(post: {
  status: PostStatus | string;
  slug: string;
  id: string;
  published_at: number | null;
}): string {
  if (post.status === "published" && post.published_at) {
    return postPath(post.slug, post.published_at);
  }
  return `/preview/${post.id}`;
}

export function CopyLinkButton({ post }: { post: PostWithCategory }) {
  const url = typeof window !== "undefined"
    ? `${window.location.origin}${getPreviewUrl(post)}`
    : getPreviewUrl(post);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("链接已复制到剪贴板");
    } catch {
      toast.error("复制链接失败");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      title="复制链接"
    >
      <Link2 className="h-4 w-4" strokeWidth={1.5} />
    </button>
  );
}
