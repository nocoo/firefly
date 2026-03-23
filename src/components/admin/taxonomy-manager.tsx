"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/i18n/context";

interface TaxonomyItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  post_count: number;
}

interface TaxonomyManagerProps {
  type: "category" | "tag";
  items: TaxonomyItem[];
  apiBase: string;
}

export function TaxonomyManager({
  type,
  items,
  apiBase,
}: TaxonomyManagerProps) {
  const router = useRouter();
  const { t } = useLocale();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const label = type === "category"
    ? t("admin.taxonomy.category")
    : t("admin.taxonomy.tag");

  const resetForm = () => {
    setName("");
    setSlug("");
    setDescription("");
    setEditing(null);
    setCreating(false);
    setError(null);
  };

  const startEdit = (item: TaxonomyItem) => {
    setCreating(false);
    setEditing(item.id);
    setName(item.name);
    setSlug(item.slug);
    setDescription(item.description ?? "");
    setError(null);
  };

  const startCreate = () => {
    setEditing(null);
    setCreating(true);
    setName("");
    setSlug("");
    setDescription("");
    setError(null);
  };

  const handleSave = async () => {
    if (!name.trim() || !slug.trim()) {
      setError(t("admin.taxonomy.nameSlugRequired"));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const body: Record<string, string> = {
        name: name.trim(),
        slug: slug.trim(),
      };
      if (description.trim()) body.description = description.trim();

      const url = editing ? `${apiBase}/${slug}` : apiBase;
      const method = editing ? "PUT" : "POST";

      // For edit, use the original slug to find the item
      const editItem = editing
        ? items.find((i) => i.id === editing)
        : null;
      const editUrl = editItem ? `${apiBase}/${editItem.slug}` : url;

      const res = await fetch(editing ? editUrl : url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? t("admin.taxonomy.failedSave", { type }));
      }

      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.taxonomy.unknownError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: TaxonomyItem) => {
    if (
      !confirm(t("admin.taxonomy.confirmDelete", { type: label, name: item.name }))
    ) {
      return;
    }

    try {
      const res = await fetch(`${apiBase}/${item.slug}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? t("admin.taxonomy.failedDelete", { type }));
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.taxonomy.unknownError"));
    }
  };

  const emptyMessage = type === "category"
    ? t("admin.taxonomy.noCategories")
    : t("admin.taxonomy.noTags");

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-[var(--radius-widget)] border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Create button */}
      {!creating && !editing && (
        <button
          onClick={startCreate}
          className="inline-flex items-center gap-2 rounded-[var(--radius-widget)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("admin.taxonomy.newItem", { label })}
        </button>
      )}

      {/* Create/Edit form */}
      {(creating || editing) && (
        <div className="rounded-[var(--radius-widget)] border border-border bg-secondary/50 p-4 space-y-3">
          <h3 className="text-sm font-medium text-foreground">
            {editing ? t("admin.taxonomy.editItem", { label }) : t("admin.taxonomy.newItem", { label })}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("admin.taxonomy.name")}
              className="rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={t("admin.taxonomy.slug")}
              className="rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("admin.taxonomy.description")}
            className="w-full rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center rounded-[var(--radius-widget)] bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? t("admin.taxonomy.saving") : t("admin.taxonomy.save")}
            </button>
            <button
              onClick={resetForm}
              className="inline-flex items-center rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
            >
              {t("admin.taxonomy.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-[var(--radius-widget)] border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                {t("admin.taxonomy.table.name")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                {t("admin.taxonomy.table.slug")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                {t("admin.taxonomy.table.description")}
              </th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                {t("admin.taxonomy.table.posts")}
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                {t("admin.taxonomy.table.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {item.slug}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {item.description ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {item.post_count}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => startEdit(item)}
                        className="text-sm text-primary hover:text-primary/80 transition-colors"
                      >
                        {t("admin.taxonomy.edit")}
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="text-sm text-destructive hover:text-destructive/80 transition-colors"
                      >
                        {t("admin.taxonomy.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
