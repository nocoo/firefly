"use client";

import Image from "next/image";
import { Copy, FileCode2, Trash2 } from "lucide-react";
import { formatFileSize } from "@/models/backup";
import {
  FileTypeIcon,
  formatDate,
  isImageMime,
  type MediaWithUrl,
} from "./media-library-helpers";

function MediaGridCard({
  item,
  onPreview,
  onCopy,
  onDelete,
}: {
  item: MediaWithUrl;
  onPreview: (item: MediaWithUrl) => void;
  onCopy: (text: string) => void;
  onDelete: (item: MediaWithUrl) => void;
}) {
  return (
    <div
      className="group relative aspect-square overflow-hidden rounded-[var(--radius-sm)] border border-border bg-secondary cursor-pointer"
      onClick={() => onPreview(item)}
    >
      {/* Thumbnail */}
      {isImageMime(item.mime_type) ? (
        <Image
          src={item.url}
          alt={item.alt_text ?? item.filename}
          fill
          sizes="(max-width: 640px) 33vw, (max-width: 768px) 20vw, (max-width: 1024px) 12.5vw, (max-width: 1280px) 10vw, (max-width: 1536px) 8.3vw, 6.25vw"
          className="object-cover transition-transform group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
          <FileTypeIcon mime={item.mime_type} className="h-8 w-8" />
          <span className="max-w-full truncate px-1.5 text-3xs">
            {item.filename.split(".").pop()?.toUpperCase()}
          </span>
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
        <div className="p-1.5">
          <p className="truncate text-2xs font-medium text-white leading-tight">
            {item.filename}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 text-3xs text-white/70">
            {item.size != null && <span>{formatFileSize(item.size)}</span>}
            <span>{formatDate(item.created_at)}</span>
          </div>

          <div className="mt-1 flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCopy(item.url);
              }}
              className="flex items-center justify-center rounded p-1 text-white/80 hover:text-white hover:bg-white/20 transition-colors"
              title="复制链接"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCopy(`![${item.filename}](${item.url})`);
              }}
              className="flex items-center justify-center rounded p-1 text-white/80 hover:text-white hover:bg-white/20 transition-colors"
              title="复制 Markdown"
            >
              <FileCode2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
              }}
              className="ml-auto flex items-center justify-center rounded p-1 text-red-400 hover:text-red-300 hover:bg-white/20 transition-colors"
              title="删除"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MediaLibraryGrid({
  media,
  onPreview,
  onCopy,
  onDelete,
}: {
  media: MediaWithUrl[];
  onPreview: (item: MediaWithUrl) => void;
  onCopy: (text: string) => void;
  onDelete: (item: MediaWithUrl) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-2 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-16">
      {media.map((item) => (
        <MediaGridCard
          key={item.id}
          item={item}
          onPreview={onPreview}
          onCopy={onCopy}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
