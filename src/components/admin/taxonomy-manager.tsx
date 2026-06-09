"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useSetPageSubtitle } from "@/components/admin/page-subtitle-context";
import {
  TaxonomyForm,
  type TaxonomyFormState,
} from "./taxonomy-manager-form";
import {
  TaxonomyTable,
  type TaxonomyItem,
} from "./taxonomy-manager-table";

export type { TaxonomyItem } from "./taxonomy-manager-table";

interface TaxonomyManagerProps {
  type: "category" | "tag";
  items: TaxonomyItem[];
  apiBase: string;
}

const EMPTY_FORM: TaxonomyFormState = { name: "", slug: "", description: "" };

export function TaxonomyManager({
  type,
  items: initialItems,
  apiBase,
}: TaxonomyManagerProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<TaxonomyFormState>(EMPTY_FORM);

  // Local item order (for optimistic reordering via up/down buttons)
  const [orderedItems, setOrderedItems] = useState(initialItems);
  // Sync when server data changes (e.g. after create/delete/edit)
  if (
    initialItems !== orderedItems &&
    initialItems.length !== orderedItems.length
  ) {
    setOrderedItems(initialItems);
  }

  const label = type === "category" ? "分类" : "标签";
  const totalText =
    type === "category"
      ? `共 ${initialItems.length} 个分类`
      : `共 ${initialItems.length} 个标签`;
  useSetPageSubtitle(totalText);

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setCreating(false);
    setError(null);
  }, []);

  const startEdit = (item: TaxonomyItem) => {
    setCreating(false);
    setEditing(item.id);
    setForm({
      name: item.name,
      slug: item.slug,
      description: item.description ?? "",
    });
    setError(null);
  };

  const startCreate = () => {
    setEditing(null);
    setCreating(true);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      setError("名称和别名为必填项");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const body: Record<string, string> = {
        name: form.name.trim(),
        slug: form.slug.trim(),
      };
      if (form.description.trim()) body.description = form.description.trim();

      const editItem = editing
        ? orderedItems.find((i) => i.id === editing)
        : null;
      const url = editItem ? `${apiBase}/${editItem.slug}` : apiBase;
      const method = editing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `保存${label}失败`);
      }

      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setSaving(false);
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<TaxonomyItem | null>(null);

  const handleDelete = async (item: TaxonomyItem) => {
    setDeleteTarget(null);
    try {
      const res = await fetch(`${apiBase}/${item.slug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `删除${label}失败`);
      }
      toast.success("删除", { description: item.name });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "未知错误");
    }
  };

  const move = useCallback(
    async (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= orderedItems.length) return;

      const previous = orderedItems;
      const reordered = [...orderedItems];
      [reordered[index], reordered[target]] = [
        reordered[target],
        reordered[index],
      ];
      setOrderedItems(reordered);

      try {
        const res = await fetch(`${apiBase}/reorder`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: reordered.map((i) => i.id) }),
        });
        if (!res.ok) throw new Error("Failed to save order");
        toast.success("排序已保存");
      } catch {
        setOrderedItems(previous);
        toast.error("未知错误");
      }
    },
    [orderedItems, apiBase],
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-widget border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!creating && !editing && (
        <button
          onClick={startCreate}
          className="inline-flex items-center gap-2 rounded-widget bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {`新建${label}`}
        </button>
      )}

      {(creating || editing) && (() => {
        const currentSlug = editing
          ? orderedItems.find((it) => it.id === editing)?.slug
          : undefined;
        return (
          <TaxonomyForm
            label={label}
            editing={!!editing}
            state={form}
            saving={saving}
            existingSlugs={new Set(orderedItems.map((it) => it.slug))}
            {...(currentSlug ? { currentSlug } : {})}
            onChange={setForm}
            onSave={handleSave}
            onCancel={resetForm}
          />
        );
      })()}

      <TaxonomyTable
        type={type}
        items={orderedItems}
        onMove={move}
        onEdit={startEdit}
        onDelete={setDeleteTarget}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={
          deleteTarget
            ? `确认删除${label}「${deleteTarget.name}」？此操作不可撤销。`
            : ""
        }
        description=""
        destructive
        confirmLabel="删除"
        cancelLabel="取消"
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
        }}
      />
    </div>
  );
}
