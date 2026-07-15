"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

interface DeletePostButtonProps {
  slug: string;
  title: string;
  /** Render icon-only (no label text). Used inside grid card overlays. */
  iconOnly?: boolean;
}

export function DeletePostButton({ slug, title, iconOnly }: DeletePostButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const openConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    setConfirmOpen(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/posts/${slug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "删除文章失败");
      }
      toast.success("删除", {
        description: title,
      });
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "删除失败",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {iconOnly ? (
        <button type="button"
          onClick={openConfirm}
          disabled={deleting}
          className="flex h-8 w-8 items-center justify-center rounded-widget bg-white/90 text-destructive transition-colors hover:bg-white disabled:opacity-50"
          title="删除"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
        </button>
      ) : (
        <button type="button"
          onClick={openConfirm}
          disabled={deleting}
          className="inline-flex items-center gap-1 rounded-widget px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          {deleting ? "..." : "删除"}
        </button>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`确认删除「${title}」？此操作不可撤销。`}
        description=""
        destructive
        confirmLabel="删除"
        cancelLabel="取消"
        onConfirm={handleDelete}
      />
    </>
  );
}
