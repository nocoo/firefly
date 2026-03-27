"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Trash2, Copy, FileCode2 } from "lucide-react";
import type { Attachment } from "@/models/types";
import { formatFileSize } from "@/models/backup";
import { ConfirmDialog } from "./confirm-dialog";
import { useLocale } from "@/i18n/context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MediaWithUrl extends Attachment {
  url: string;
}

interface MediaLibraryProps {
  initialMedia: MediaWithUrl[];
  initialTotal: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MediaLibrary({ initialMedia, initialTotal }: MediaLibraryProps) {
  const { t } = useLocale();
  const [media, setMedia] = useState<MediaWithUrl[]>(initialMedia);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaWithUrl | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pageRef = useRef(1);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const nextPage = pageRef.current + 1;
      const res = await fetch(`/api/media?page=${nextPage}&page_size=24`);
      if (!res.ok) return;
      const data = await res.json();
      setMedia((prev) => [...prev, ...data.media]);
      setTotal(data.total);
      pageRef.current = nextPage;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/media/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(t("admin.media.deleteError"));
        return;
      }
      setMedia((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setTotal((prev) => prev - 1);
      toast.success(t("admin.media.deleted"));
    } catch {
      toast.error(t("admin.media.deleteError"));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, t]);

  const copyToClipboard = useCallback(
    async (text: string, key: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => setCopiedKey(null), 800);
        toast.success(t("admin.media.copied"));
      } catch {
        // Silently ignore clipboard failures
      }
    },
    [t],
  );

  const formatDate = (epoch: number) => {
    return new Date(epoch * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // ── Empty state ──
  if (media.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-foreground">
          {t("admin.media.empty")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("admin.media.emptyHint")}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Count */}
      <p className="mb-4 text-sm text-muted-foreground">
        {t("admin.media.showing")
          .replace("{count}", String(media.length))
          .replace("{total}", String(total))}
      </p>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {media.map((item) => (
          <div
            key={item.id}
            className="group relative overflow-hidden rounded-[var(--radius-widget)] border border-border bg-secondary/30"
          >
            {/* Thumbnail */}
            <div className="aspect-square overflow-hidden bg-secondary">
              <img
                src={item.url}
                alt={item.alt_text ?? item.filename}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            </div>

            {/* Info */}
            <div className="p-2.5">
              <p className="truncate text-xs font-medium text-foreground">
                {item.filename}
              </p>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                {item.size != null && <span>{formatFileSize(item.size)}</span>}
                <span>{formatDate(item.created_at)}</span>
              </div>

              {/* Actions */}
              <div className="mt-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => copyToClipboard(item.url, `url-${item.id}`)}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title={t("admin.media.copyUrl")}
                >
                  <Copy className="h-3 w-3" />
                  {copiedKey === `url-${item.id}` ? t("admin.media.copied") : t("admin.media.copyUrl")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      `![${item.filename}](${item.url})`,
                      `md-${item.id}`,
                    )
                  }
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title={t("admin.media.copyMarkdown")}
                >
                  <FileCode2 className="h-3 w-3" />
                  {copiedKey === `md-${item.id}` ? t("admin.media.copied") : "MD"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(item)}
                  className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title={t("admin.media.delete")}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load more */}
      {media.length < total && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-[var(--radius-widget)] border border-border bg-secondary px-6 py-2 text-sm text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            {loading ? "..." : t("admin.media.loadMore")}
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t("admin.media.delete")}
        description={t("admin.media.confirmDelete")}
        confirmLabel={deleting ? "..." : t("admin.media.delete")}
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
