"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImageLightboxProps {
  /** Image source URL */
  src: string;
  /** Image alt text */
  alt?: string;
  /** Whether the lightbox is open */
  open: boolean;
  /** Called when the lightbox should close */
  onClose: () => void;
  /** Optional side panel content (metadata, actions, etc.) */
  children?: ReactNode;
  /** Optional custom content to replace the default <img> in the main pane */
  previewContent?: ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImageLightbox({
  src,
  alt,
  open,
  onClose,
  children,
  previewContent,
}: ImageLightboxProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const hasPanel = !!children;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Content — stop propagation so clicking inside doesn't close */}
      <div
        className={
          "relative flex max-h-[90vh] max-w-[90vw] overflow-hidden rounded-card shadow-2xl" +
          (hasPanel
            ? " flex-col bg-card md:flex-row"
            : " items-center justify-center")
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950/50 text-white/80 transition-colors hover:bg-zinc-950/70 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Image pane */}
        <div
          className={
            "flex flex-1 items-center justify-center p-4" +
            (hasPanel ? " bg-zinc-950/20 md:min-w-[400px]" : "")
          }
        >
          {previewContent ?? (
            <img
              src={src}
              alt={alt ?? ""}
              className="max-h-[60vh] max-w-full rounded object-contain md:max-h-[80vh]"
            />
          )}
        </div>

        {/* Optional side panel */}
        {children && (
          <div className="flex w-full flex-col gap-4 border-t border-border p-5 md:w-72 md:border-l md:border-t-0">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
