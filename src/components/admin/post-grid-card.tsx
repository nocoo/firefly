"use client";

import { memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Eye, Pencil } from "lucide-react";
import type { PostWithCategory, PostStatus } from "@/models/types";
import { postPath, formatDateDisplay } from "@/lib/seo";
import { DeletePostButton } from "./delete-post-button";
import { useLocale } from "@/i18n/context";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

const STATUS_COLORS: Record<PostStatus, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  published: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  private: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  archived: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
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
  const { t } = useLocale();
  const previewUrl = getPreviewUrl(post);
  const date = post.published_at ? formatDateDisplay(post.published_at) : "—";

  return (
    <Card
      className={`group relative overflow-hidden shadow-sm transition-colors ${
        selected
          ? "border-primary ring-2 ring-primary/20"
          : "hover:border-primary/50"
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
            className={`h-4 w-4 cursor-pointer rounded border-border text-primary shadow-sm focus:ring-ring ${
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
          <div className="relative h-[var(--card-thumb-height)] bg-secondary">
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
            <p className="font-[var(--ff-body)] text-base leading-snug text-blog-text line-clamp-5">
              {post.excerpt || post.title}
            </p>
          </div>
        )}
      </Link>

      {/* Hover overlay — covers only the image area */}
      <div className="absolute inset-x-0 top-0 h-[var(--card-thumb-height)] flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-widget)] bg-white/90 text-gray-800 transition-colors hover:bg-white"
          title={t("admin.posts.preview")}
        >
          <Eye className="h-4 w-4" strokeWidth={1.5} />
        </a>
        <Link
          href={`/admin/posts/${post.id}/edit`}
          onClick={(e) => e.stopPropagation()}
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-widget)] bg-white/90 text-gray-800 transition-colors hover:bg-white"
          title={t("admin.posts.edit")}
        >
          <Pencil className="h-4 w-4" strokeWidth={1.5} />
        </Link>
        <DeletePostButton slug={post.slug} title={post.title} iconOnly />
      </div>

      {/* Title — flex-1 fills remaining space so footer always sits at bottom */}
      <CardContent className="border-t border-border px-2.5 py-2">
        <Link
          href={`/admin/posts/${post.id}/edit`}
          className="block text-sm font-medium leading-snug text-foreground line-clamp-2 hover:text-primary transition-colors"
        >
          {post.title}
        </Link>
      </CardContent>

      {/* Status + date — always pinned to bottom */}
      <CardFooter className="px-2.5 pb-2 pt-0">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${STATUS_COLORS[post.status as PostStatus] ?? ""}`}
          >
            {t(`admin.posts.status.${post.status}`)}
          </span>
          <span className="text-[11px] text-muted-foreground">{date}</span>
        </div>
      </CardFooter>
    </Card>
  );
});
