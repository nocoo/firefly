"use client";

import { useState, useCallback } from "react";

interface ImageUploadProps {
  onUpload: (url: string) => void;
  className?: string;
}

/**
 * Image upload button + drag-and-drop zone.
 * Uploads to /api/upload and returns the public URL.
 */
export function ImageUpload({ onUpload, className }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

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
          throw new Error(data.error ?? "Upload failed");
        }

        const data = await res.json();
        onUpload(data.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onUpload],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    // Reset input so the same file can be selected again
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

  return (
    <div className={className}>
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
            {uploading ? "Uploading..." : "📎 Upload image"}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/avif"
            onChange={handleFileSelect}
            disabled={uploading}
            className="sr-only"
          />
        </label>
        {!uploading && (
          <span className="text-muted-foreground/60">or drag & drop</span>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
