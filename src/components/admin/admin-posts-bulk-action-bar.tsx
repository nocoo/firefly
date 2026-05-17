"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { Category } from "@/models/types";
import { Select } from "@/components/ui/select";

export function AdminPostsBulkActionBar({
  selectedIds,
  categories,
  onClearSelection,
}: {
  selectedIds: Set<string>;
  categories: Category[];
  onClearSelection: () => void;
}) {
  const router = useRouter();
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    const updates: Record<string, unknown> = {};
    if (bulkStatus) updates.status = bulkStatus;
    if (bulkCategory === "__none__") updates.category_id = null;
    else if (bulkCategory) updates.category_id = bulkCategory;

    if (Object.keys(updates).length === 0) return;

    setApplying(true);
    try {
      const res = await fetch("/api/admin/posts/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [...selectedIds],
          updates,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "批量更新失败");
      }

      const data = await res.json();
      onClearSelection();
      setBulkStatus("");
      setBulkCategory("");
      router.refresh();

      if (data.changed > 0) {
        toast.success(`已更新 ${data.changed} 篇文章`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "批量更新失败");
    } finally {
      setApplying(false);
    }
  };

  const hasUpdates = bulkStatus !== "" || bulkCategory !== "";

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-widget border border-primary/30 bg-primary/5 px-4 py-3 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {`已选 ${selectedIds.size} 篇`}
        </span>
        <button
          type="button"
          onClick={onClearSelection}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
          aria-label="取消全选"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="h-5 w-px bg-border" />

      <div className="flex items-center gap-1.5">
        <label className="text-xs text-muted-foreground whitespace-nowrap">
          设置状态
        </label>
        <Select
          value={bulkStatus}
          onChange={(e) => setBulkStatus(e.target.value)}
          className="w-auto !h-8 !py-1 text-xs"
        >
          <option value="">—</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
          <option value="private">私密</option>
          <option value="archived">已归档</option>
        </Select>
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-xs text-muted-foreground whitespace-nowrap">
          设置分类
        </label>
        <Select
          value={bulkCategory}
          onChange={(e) => setBulkCategory(e.target.value)}
          className="w-auto !h-8 !py-1 text-xs"
        >
          <option value="">—</option>
          <option value="__none__">无分类</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </Select>
      </div>

      <button
        type="button"
        onClick={handleApply}
        disabled={applying || !hasUpdates}
        className="inline-flex items-center gap-1 rounded-widget bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {applying ? "应用中..." : "应用"}
      </button>
    </div>
  );
}
