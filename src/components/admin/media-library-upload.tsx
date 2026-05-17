"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { MediaWithUrl } from "./media-library-helpers";

export interface UploadHandlers {
  dragOver: boolean;
  uploading: boolean;
  uploadProgress: { current: number; total: number };
  onDragEnter: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

/**
 * Drag-and-drop upload hook. Calls `onUploadComplete` for each successfully
 * uploaded file so the caller can prepend it into the grid.
 */
export function useMediaUpload(
  onUploadComplete: (item: MediaWithUrl) => void,
): UploadHandlers {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
  });
  const dragCounterRef = useRef(0);

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

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      setUploading(true);
      setUploadProgress({ current: 0, total: files.length });

      let successCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length });

        try {
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch("/api/media", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const data = await res.json();
            toast.error(
              `上传失败：${file.name}` +
                (data.error ? `: ${data.error}` : ""),
            );
            continue;
          }

          const data = await res.json();
          onUploadComplete({ ...data, url: data.url });
          successCount++;
        } catch {
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
    uploadProgress,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
  };
}
