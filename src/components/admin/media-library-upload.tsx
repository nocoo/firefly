"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { MediaWithUrl } from "./media-library-helpers";

export type UploadStatus = "pending" | "uploading" | "success" | "error";

export interface UploadItem {
  /** Stable per-drop id so React can key entries while the same file is processed. */
  id: string;
  name: string;
  size: number;
  status: UploadStatus;
  /** Set when status === "error". */
  errorMessage?: string;
}

export interface UploadHandlers {
  dragOver: boolean;
  uploading: boolean;
  /** Per-file queue state. Empty between drops. */
  queue: UploadItem[];
  /** Clear the queue from the UI (e.g. after the user dismisses it). */
  dismissQueue: () => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

/**
 * Drag-and-drop upload hook. Calls `onUploadComplete` for each successfully
 * uploaded file so the caller can prepend it into the grid. Exposes per-file
 * queue state (pending / uploading / success / error) so the UI can render an
 * actual upload list instead of a single "X / Y" counter — failures stay
 * visible until the user dismisses them.
 */
export function useMediaUpload(
  onUploadComplete: (item: MediaWithUrl) => void,
): UploadHandlers {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const dragCounterRef = useRef(0);
  const idCounterRef = useRef(0);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setDragOver(true);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setDragOver(false);
  }, []);

  const dismissQueue = useCallback(() => {
    if (uploading) return;
    setQueue([]);
  }, [uploading]);

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      // New drop starts a fresh queue (no carry-over from prior runs).
      const items: UploadItem[] = files.map((f) => ({
        id: `upload-${++idCounterRef.current}`,
        name: f.name,
        size: f.size,
        status: "pending",
      }));
      setQueue(items);
      setUploading(true);

      let successCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const itemId = items[i].id;
        setQueue((prev) =>
          prev.map((it) =>
            it.id === itemId ? { ...it, status: "uploading" } : it,
          ),
        );

        try {
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch("/api/media", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const data = (await res.json()) as { error?: string };
            const msg = data.error ?? "上传失败";
            setQueue((prev) =>
              prev.map((it) =>
                it.id === itemId
                  ? { ...it, status: "error", errorMessage: msg }
                  : it,
              ),
            );
            toast.error(`上传失败：${file.name}: ${msg}`);
            continue;
          }

          const data = await res.json();
          onUploadComplete({ ...data, url: data.url });
          successCount++;
          setQueue((prev) =>
            prev.map((it) =>
              it.id === itemId ? { ...it, status: "success" } : it,
            ),
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : "上传失败";
          setQueue((prev) =>
            prev.map((it) =>
              it.id === itemId
                ? { ...it, status: "error", errorMessage: msg }
                : it,
            ),
          );
          toast.error(`上传失败：${file.name}`);
        }
      }

      setUploading(false);
      if (successCount > 0) {
        toast.success(`已上传 ${successCount} 个文件`);
      }
    },
    [onUploadComplete],
  );

  return {
    dragOver,
    uploading,
    queue,
    dismissQueue,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
  };
}
