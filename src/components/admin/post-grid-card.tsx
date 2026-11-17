"use client";

import { memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Eye, Pencil } from "@nocoo/basalt/icons";
import type { PostWithCategory, PostStatus } from "@/models/types";
import { postPath, formatDateDisplay } from "@/lib/seo";
import { STATUS_COLORS } from "@/lib/status-colors";
import { DeletePostButton } from "./delete-post-button";
import { LayerCard } from "@nocoo/basalt/components/layer-card";

const POST_STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  private: "私密",
  archived: "已归档",
};

interface PostGridCardProps {
  post: PostWithCategory;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

function getPreviewUrl(post: PostWithCategory): string {
  if (post.status === "published" && post.published_at) {
    return postPath(post.slug, post.published_at);
  }
  return `/preview/${post.id}`;
}

export const PostGridCard = memo(function PostGridCard({
  post,
  selected,
  onToggleSelect,
}: PostGridCardProps) {
  const previewUrl = getPreviewUrl(post);
  const date = post.published_at ? formatDateDisplay(post.published_at) : "—";

  return (
    <LayerCard
      padding="none"
      className={`group relative overflow-hidden transition-colors ${
        selected
          ? "border-basalt-primary ring-2 ring-basalt-primary/20"
          : "hover:border-basalt-primary/50"
      }`}
    >
      {/* Selection checkbox — always visible in top-left */}
      {onToggleSelect && (
        <div className="absolute left-2 top-2 z-10">
          <input
            type="checkbox"
            checked={selected ?? false}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect(post.id);
            }}
            className={`h-4 w-4 cursor-pointer rounded border-basalt-border text-basalt-primary focus:ring-basalt-ring ${
              selected
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100"
            } transition-opacity`}
          />
        </div>
      )}

      {/* Top area — featured image or text preview */}
      <Link href={`/admin/posts/${post.id}/edit`} className="block">
        {post.featured_image ? (
          <div className="relative h-[var(--card-thumb-height)] bg-basalt-secondary">
            <Image
              src={post.featured_image}
              alt={post.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="h-[var(--card-thumb-height)] overflow-hidden bg-blog-bg p-3">
            <p className="font-body text-base leading-snug text-blog-text line-clamp-5">
              {post.excerpt || post.title}
            </p>
          </div>
        )}
      </Link>

      {/* Hover overlay — covers only the image area */}
      <div className="absolute inset-x-0 top-0 h-[var(--card-thumb-height)] flex items-center justify-center gap-2 bg-zinc-950/40 opacity-0 transition-opacity group-hover:opacity-100">
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex h-8 w-8 items-center justify-center rounded-widget bg-basalt-card/90 text-basalt-card-foreground transition-colors hover:bg-basalt-card"
          title="预览"
        >
          <Eye className="h-4 w-4" strokeWidth={1.5} />
        </a>
        <Link
          href={`/admin/posts/${post.id}/edit`}
          onClick={(e) => e.stopPropagation()}
          className="flex h-8 w-8 items-center justify-center rounded-widget bg-basalt-card/90 text-basalt-card-foreground transition-colors hover:bg-basalt-card"
          title="编辑"
        >
          <Pencil className="h-4 w-4" strokeWidth={1.5} />
        </Link>
        <DeletePostButton slug={post.slug} title={post.title} iconOnly />
      </div>

      {/* Title — flex-1 fills remaining space so footer always sits at bottom */}
      <LayerCard.Body className="border-t border-basalt-border px-2.5 py-2">
        <Link
          href={`/admin/posts/${post.id}/edit`}
          className="block text-sm font-medium leading-snug text-basalt-foreground line-clamp-2 hover:text-basalt-primary transition-colors"
        >
          {post.title}
        </Link>
      </LayerCard.Body>

      {/* Status + date — always pinned to bottom */}
      <LayerCard.Footer className="px-2.5 pb-2 pt-0">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block rounded-full px-1.5 py-0.5 text-2xs font-medium leading-none ${STATUS_COLORS[post.status as PostStatus] ?? ""}`}
          >
            {POST_STATUS_LABEL[post.status] ?? post.status}
          </span>
          <span className="text-xs text-basalt-muted-foreground">{date}</span>
        </div>
      </LayerCard.Footer>
    </LayerCard>
  );
});
