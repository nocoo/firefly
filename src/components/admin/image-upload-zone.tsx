"use client";

import { useState, useCallback, useRef, useEffect } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadResult {
  id: string;
  url: string;
  filename: string;
}

interface ImageUploadZoneProps {
  className?: string;
  /** Optional post ID — uploads will be associated with this post in the DB. */
  postId?: string;
  /** Controlled: current list of uploaded media. */
  results: UploadResult[];
  /** Controlled: setState-style callback (supports functional updater to avoid stale closures). */
  onResultsChange: React.Dispatch<React.SetStateAction<UploadResult[]>>;
}

/**
 * Image upload zone with drag-and-drop, thumbnail previews,
 * and copy URL / copy Markdown buttons.
 *
 * Controlled component — parent owns the results array.
 * Supports continuous uploads (new uploads prepend to the list).
 */
export function ImageUploadZone({
  className,
  postId,
  results,
  onResultsChange,
}: ImageUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current); }, []);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        if (postId) {
          formData.append("post_id", postId);
        }

        const res = await fetch("/api/media", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "上传失败");
        }

        const data = await res.json();
        const newResult: UploadResult = {
          id: data.id,
          url: data.url,
          filename: file.name,
        };
        // Functional updater avoids stale closure — always sees latest state
        onResultsChange((prev) => [newResult, ...prev]);
        setCopiedField(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "上传失败");
      } finally {
        setUploading(false);
      }
    },
    [postId, onResultsChange],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      upload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const dismiss = useCallback(
    (id: string) => {
      onResultsChange((prev) => prev.filter((r) => r.id !== id));
    },
    [onResultsChange],
  );

  const copyToClipboard = useCallback(
    async (text: string, key: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedField(key);

        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = setTimeout(() => {
          setCopiedField(null);
          copyTimeoutRef.current = null;
        }, 800);
      } catch {
        // Clipboard API may fail in insecure contexts — silently ignore
      }
    },
    [],
  );

  return (
    <div className={className}>
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex items-center gap-2 rounded-widget border border-dashed px-3 py-2 text-xs transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground"
        }`}
      >
        <label className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
          <span>
            {uploading ? "上传中..." : "📎 上传图片"}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
            onChange={handleFileSelect}
            disabled={uploading}
            className="sr-only"
          />
        </label>
        {!uploading && (
          <span className="text-muted-foreground/60">或拖拽上传</span>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}

      {/* Results list — scrollable when >3 items */}
      {results.length > 0 && (
        <div className="mt-2 space-y-1.5 max-h-[200px] overflow-y-auto">
          {results.map((result) => (
            <div
              key={result.id}
              className="flex items-center gap-3 rounded-widget border border-border bg-secondary/50 px-3 py-2"
            >
              {/* Thumbnail */}
              <img
                src={result.url}
                alt={result.filename}
                className="h-10 w-10 shrink-0 rounded object-cover"
              />

              {/* Copy buttons */}
              <div className="flex flex-1 gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(result.url, `url-${result.id}`)}
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  {copiedField === `url-${result.id}` ? "已复制！" : "复制链接"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(`![${result.filename}](${result.url})`, `md-${result.id}`)
                  }
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  {copiedField === `md-${result.id}`
                    ? "已复制！"
                    : "复制 Markdown"}
                </button>
              </div>

              {/* Dismiss */}
              <button
                type="button"
                onClick={() => dismiss(result.id)}
                className="shrink-0 rounded p-1 text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
                aria-label="关闭"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
