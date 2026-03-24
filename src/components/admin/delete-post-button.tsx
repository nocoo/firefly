"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useLocale } from "@/i18n/context";

interface DeletePostButtonProps {
  slug: string;
  title: string;
  /** Render icon-only (no label text). Used inside grid card overlays. */
  iconOnly?: boolean;
}

export function DeletePostButton({ slug, title, iconOnly }: DeletePostButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const { t } = useLocale();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(t("admin.deletePost.confirm", { title }))) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/posts/${slug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? t("admin.deletePost.failedDelete"));
      }
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("admin.deletePost.failedGeneric"));
    } finally {
      setDeleting(false);
    }
  };

  if (iconOnly) {
    return (
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-widget)] bg-white/90 text-destructive transition-colors hover:bg-white disabled:opacity-50"
        title={t("admin.posts.delete")}
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
      </button>
    );
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="inline-flex items-center gap-1 rounded-[var(--radius-widget)] px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
      {deleting ? "..." : t("admin.posts.delete")}
    </button>
  );
}
