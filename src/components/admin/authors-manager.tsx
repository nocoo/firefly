"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Star, User } from "lucide-react";
import { toast } from "sonner";
import type { HumanWithMeta } from "@/models/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";

export interface HumanWithAvatarUrl extends HumanWithMeta {
  avatarUrl: string | null;
}

export function AuthorsManager({
  authors: initialAuthors,
}: {
  authors: HumanWithAvatarUrl[];
}) {
  const router = useRouter();
  const [authors, setAuthors] = useState(initialAuthors);
  const [confirmDelete, setConfirmDelete] = useState<HumanWithAvatarUrl | null>(
    null,
  );

  const handleSetDefault = async (author: HumanWithAvatarUrl) => {
    try {
      const res = await fetch(`/api/admin/authors/${author.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "设为默认失败");
      }
      setAuthors((prev) =>
        prev.map((item) => ({
          ...item,
          is_default: item.id === author.id ? 1 : 0,
        })),
      );
      toast.success("已设为默认作者");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "设为默认失败");
    }
  };

  const handleDelete = async (author: HumanWithAvatarUrl) => {
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/admin/authors/${author.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "删除失败");
      }
      setAuthors((prev) => prev.filter((item) => item.id !== author.id));
      toast.success("作者已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">作者</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理人类作者。AI 代理仍在「AI 代理」页维护。
          </p>
        </div>
        <Button onClick={() => router.push("/admin/authors/new")}>
          <Plus className="mr-2 h-4 w-4" />
          创建作者
        </Button>
      </div>

      <div className="overflow-x-auto rounded-widget border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">作者</th>
              <th className="px-4 py-3 font-medium">标识</th>
              <th className="px-4 py-3 font-medium">邮箱</th>
              <th className="px-4 py-3 font-medium">公开</th>
              <th className="px-4 py-3 font-medium">文章</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {authors.map((author) => (
              <tr key={author.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {author.avatarUrl ? (
                      <img
                        src={author.avatarUrl}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <User className="h-4 w-4" />
                      </span>
                    )}
                    <div>
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        {author.name}
                        {author.is_default === 1 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-2xs text-primary">
                            <Star className="h-3 w-3" />
                            默认
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {author.slug}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {author.email ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {author.profile_public === 1 ? "是" : "否"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {author.post_count}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {author.is_default !== 1 && (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => handleSetDefault(author)}
                      >
                        设为默认
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-xs text-foreground hover:underline"
                      onClick={() => router.push(`/admin/authors/${author.id}`)}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline"
                      onClick={() => setConfirmDelete(author)}
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        title="删除作者"
        description={
          confirmDelete
            ? `确定删除「${confirmDelete.name}」？有文章或默认作者不能删除。`
            : ""
        }
        destructive
        confirmLabel="删除"
        cancelLabel="取消"
        onConfirm={() => {
          if (confirmDelete) handleDelete(confirmDelete);
        }}
      />
    </div>
  );
}
