"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

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

  const handleDelete = async () => {
    const msg = confirmMessage.replace("{name}", authorName);
    if (!window.confirm(msg)) return;

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
      alert(failedMessage);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive/80 disabled:opacity-50"
      aria-label={deleteLabel}
    >
      <Trash2 className="h-3 w-3" strokeWidth={1.5} />
      {deleteLabel}
    </button>
  );
}
