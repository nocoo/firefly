"use client";

import { useState, useCallback, useRef } from "react";
import { useLocale } from "@/i18n/context";

interface UploadResult {
  url: string;
  filename: string;
}

interface ImageUploadZoneProps {
  className?: string;
}

/**
 * Image upload zone with drag-and-drop, thumbnail preview,
 * and copy URL / copy Markdown buttons.
 */
export function ImageUploadZone({ className }: ImageUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [copiedField, setCopiedField] = useState<"url" | "markdown" | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useLocale();

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? t("admin.upload.failed"));
        }

        const data = await res.json();
        setResult({ url: data.url, filename: file.name });
        setCopiedField(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("admin.upload.failed"));
      } finally {
        setUploading(false);
      }
    },
    [t],
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

  const copyToClipboard = useCallback(
    async (text: string, field: "url" | "markdown") => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);

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
        className={`flex items-center gap-2 rounded-[var(--radius-widget)] border border-dashed px-3 py-2 text-xs transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground"
        }`}
      >
        <label className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
          <span>
            {uploading ? t("admin.upload.uploading") : t("admin.upload.uploadImage")}
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
          <span className="text-muted-foreground/60">{t("admin.upload.dragDrop")}</span>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}

      {/* Result card */}
      {result && !uploading && (
        <div className="mt-2 flex items-center gap-3 rounded-[var(--radius-widget)] border border-border bg-secondary/50 px-3 py-2">
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
              onClick={() => copyToClipboard(result.url, "url")}
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {copiedField === "url" ? t("admin.upload.copied") : t("admin.upload.copyUrl")}
            </button>
            <button
              type="button"
              onClick={() =>
                copyToClipboard(`![${result.filename}](${result.url})`, "markdown")
              }
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {copiedField === "markdown"
                ? t("admin.upload.copied")
                : t("admin.upload.copyMarkdown")}
            </button>
          </div>

          {/* Dismiss */}
          <button
            type="button"
            onClick={() => setResult(null)}
            className="shrink-0 rounded p-1 text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
            aria-label={t("admin.upload.dismiss")}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
