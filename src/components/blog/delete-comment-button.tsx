"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

interface DeleteCommentButtonProps {
  commentId: string;
  authorName: string;
  confirmMessage: string;
  deleteLabel: string;
  failedMessage: string;
}

export function DeleteCommentButton({
  commentId,
  authorName,
  confirmMessage,
  deleteLabel,
  failedMessage,
}: DeleteCommentButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = async () => {
    setConfirmOpen(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/comments/${commentId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(failedMessage);
      }

      router.refresh();
    } catch {
      toast.error(failedMessage);
    } finally {
      setDeleting(false);
    }
  };

  const confirmTitle = confirmMessage.replace("{name}", authorName);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={deleting}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive/80 disabled:opacity-50"
        aria-label={deleteLabel}
      >
        <Trash2 className="h-3 w-3" strokeWidth={1.5} />
        {deleteLabel}
      </button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmTitle}
        description=""
        destructive
        confirmLabel={deleteLabel}
        onConfirm={handleDelete}
      />
    </>
  );
}
