"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/i18n/context";

interface DeletePostButtonProps {
  slug: string;
  title: string;
}

export function DeletePostButton({ slug, title }: DeletePostButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const { t } = useLocale();

  const handleDelete = async () => {
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

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-sm text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
    >
      {deleting ? "..." : t("admin.deletePost.delete")}
    </button>
  );
}
