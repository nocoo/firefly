"use client";

import { Calendar, Copy, FileCode2, HardDrive, RulerIcon, Trash2 } from "lucide-react";
import { formatFileSize } from "@/models/backup";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import {
  FileTypeIcon,
  formatDate,
  isImageMime,
  type MediaWithUrl,
} from "./media-library-helpers";

export function MediaLibraryPreview({
  preview,
  onClose,
  onCopy,
  onDelete,
}: {
  preview: MediaWithUrl | null;
  onClose: () => void;
  onCopy: (text: string) => void;
  onDelete: (item: MediaWithUrl) => void;
}) {
  return (
    <ImageLightbox
      src={preview?.url ?? ""}
      alt={preview?.alt_text ?? preview?.filename ?? ""}
      open={!!preview}
      onClose={onClose}
      previewContent={
        preview && !isImageMime(preview.mime_type)
          ? (
            <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <FileTypeIcon mime={preview.mime_type} className="h-16 w-16" />
              <span className="text-sm font-medium">{preview.filename}</span>
            </div>
          )
          : undefined
      }
    >
      {preview && (
        <>
          <h3 className="truncate text-sm font-semibold text-foreground">
            {preview.filename}
          </h3>

          <div className="flex flex-col gap-2.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <FileTypeIcon mime={preview.mime_type} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{preview.mime_type}</span>
            </div>
            {preview.size != null && (
              <div className="flex items-center gap-2">
                <HardDrive className="h-3.5 w-3.5 shrink-0" />
                <span>{formatFileSize(preview.size)}</span>
              </div>
            )}
            {preview.width != null && preview.height != null && (
              <div className="flex items-center gap-2">
                <RulerIcon className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {preview.width} x {preview.height}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>{formatDate(preview.created_at)}</span>
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onCopy(preview.url)}
              className="flex items-center justify-center gap-1.5 rounded-widget border border-border bg-secondary px-3 py-2 text-xs text-foreground transition-colors hover:bg-accent"
            >
              <Copy className="h-3.5 w-3.5" />
              复制链接
            </button>
            <button
              type="button"
              onClick={() => onCopy(`![${preview.filename}](${preview.url})`)}
              className="flex items-center justify-center gap-1.5 rounded-widget border border-border bg-secondary px-3 py-2 text-xs text-foreground transition-colors hover:bg-accent"
            >
              <FileCode2 className="h-3.5 w-3.5" />
              复制 Markdown
            </button>
            <button
              type="button"
              onClick={() => onDelete(preview)}
              className="flex items-center justify-center gap-1.5 rounded-widget border border-destructive/30 px-3 py-2 text-xs text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </button>
          </div>
        </>
      )}
    </ImageLightbox>
  );
}
