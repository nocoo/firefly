"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "@nocoo/basalt/icons";
import { toast } from "@nocoo/basalt/components/toast";
import type { Category } from "@/models/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nocoo/basalt/components/select";

const EMPTY = "__empty__";

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
      toast.danger(err instanceof Error ? err.message : "批量更新失败");
    } finally {
      setApplying(false);
    }
  };

  const hasUpdates = bulkStatus !== "" || bulkCategory !== "";

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-widget border border-basalt-primary/30 bg-basalt-primary/5 px-4 py-3 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-basalt-foreground">
          {`已选 ${selectedIds.size} 篇`}
        </span>
        <button
          type="button"
          onClick={onClearSelection}
          className="flex h-5 w-5 items-center justify-center rounded text-basalt-muted-foreground hover:text-basalt-foreground transition-colors"
          aria-label="取消全选"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="h-5 w-px bg-basalt-border" />

      <div className="flex items-center gap-1.5">
        <label
          htmlFor="bulk-status"
          className="text-xs text-basalt-muted-foreground whitespace-nowrap"
        >
          设置状态
        </label>
        <Select
          value={bulkStatus === "" ? EMPTY : bulkStatus}
          onValueChange={(next) => setBulkStatus(next === EMPTY ? "" : next)}
        >
          <SelectTrigger id="bulk-status" size="sm" className="w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY}>—</SelectItem>
            <SelectItem value="published">已发布</SelectItem>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="private">私密</SelectItem>
            <SelectItem value="archived">已归档</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1.5">
        <label
          htmlFor="bulk-category"
          className="text-xs text-basalt-muted-foreground whitespace-nowrap"
        >
          设置分类
        </label>
        <Select
          value={bulkCategory === "" ? EMPTY : bulkCategory}
          onValueChange={(next) => setBulkCategory(next === EMPTY ? "" : next)}
        >
          <SelectTrigger id="bulk-category" size="sm" className="w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY}>—</SelectItem>
            <SelectItem value="__none__">无分类</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <button
        type="button"
        onClick={handleApply}
        disabled={applying || !hasUpdates}
        className="inline-flex items-center gap-1 rounded-widget bg-basalt-primary px-3 py-1.5 text-xs font-medium text-basalt-primary-foreground transition-colors hover:bg-basalt-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {applying ? "应用中..." : "应用"}
      </button>
    </div>
  );
}
