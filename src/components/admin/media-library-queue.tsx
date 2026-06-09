"use client";

import { CheckCircle2, Loader2, Upload, X, XCircle } from "lucide-react";
import type { UploadItem } from "./media-library-upload";

interface MediaUploadQueueProps {
  items: UploadItem[];
  uploading: boolean;
  onDismiss: () => void;
}

/**
 * Per-file upload progress list shown above the media grid.
 *
 * Replaces the old single-line "上传中 3/10..." counter so users can:
 *   - See which file is currently uploading
 *   - Spot exactly which uploads failed (the toast disappears; this stays)
 *   - Dismiss the list once the batch is done
 */
export function MediaUploadQueue({
  items,
  uploading,
  onDismiss,
}: MediaUploadQueueProps) {
  if (items.length === 0) return null;

  const errorCount = items.filter((it) => it.status === "error").length;
  const successCount = items.filter((it) => it.status === "success").length;

  return (
    <div className="mb-4 rounded-widget border border-border bg-secondary">
      <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          {uploading ? (
            <Loader2
              className="h-4 w-4 animate-spin"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          ) : (
            <Upload className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          )}
          <span>
            {uploading
              ? `上传中：${successCount}/${items.length} 已完成${errorCount ? `（${errorCount} 失败）` : ""}`
              : errorCount
                ? `已完成：${successCount} 成功，${errorCount} 失败`
                : `已完成：${successCount} 个文件`}
          </span>
        </div>
        {!uploading && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
      </div>
      <ul className="max-h-48 divide-y divide-border overflow-y-auto">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-2 px-4 py-2 text-xs"
          >
            {renderStatusIcon(item.status)}
            <span className="flex-1 truncate text-foreground">{item.name}</span>
            <span className="shrink-0 text-muted-foreground">
              {formatBytes(item.size)}
            </span>
            {item.status === "error" && item.errorMessage && (
              <span
                className="ml-2 shrink-0 max-w-[12rem] truncate text-destructive"
                title={item.errorMessage}
              >
                {item.errorMessage}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderStatusIcon(status: UploadItem["status"]) {
  switch (status) {
    case "pending":
      return (
        <span
          className="h-3.5 w-3.5 shrink-0 rounded-full border border-border"
          aria-label="排队中"
        />
      );
    case "uploading":
      return (
        <Loader2
          className="h-3.5 w-3.5 shrink-0 animate-spin text-primary"
          strokeWidth={2}
          aria-label="上传中"
        />
      );
    case "success":
      return (
        <CheckCircle2
          className="h-3.5 w-3.5 shrink-0 text-success"
          strokeWidth={2}
          aria-label="已完成"
        />
      );
    case "error":
      return (
        <XCircle
          className="h-3.5 w-3.5 shrink-0 text-destructive"
          strokeWidth={2}
          aria-label="失败"
        />
      );
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
