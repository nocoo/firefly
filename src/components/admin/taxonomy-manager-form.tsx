"use client";

export interface TaxonomyFormState {
  name: string;
  slug: string;
  description: string;
}

export function TaxonomyForm({
  label,
  editing,
  state,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  label: string;
  editing: boolean;
  state: TaxonomyFormState;
  saving: boolean;
  onChange: (next: TaxonomyFormState) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-widget border border-border bg-secondary/50 p-4 space-y-3">
      <h3 className="text-sm font-medium text-foreground">
        {editing ? `编辑${label}` : `新建${label}`}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          value={state.name}
          onChange={(e) => onChange({ ...state, name: e.target.value })}
          placeholder="名称"
          className="rounded-widget border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="text"
          value={state.slug}
          onChange={(e) => onChange({ ...state, slug: e.target.value })}
          placeholder="别名"
          className="rounded-widget border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <input
        type="text"
        value={state.description}
        onChange={(e) => onChange({ ...state, description: e.target.value })}
        placeholder="描述（可选）"
        className="w-full rounded-widget border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center rounded-widget bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        <button
          onClick={onCancel}
          className="inline-flex items-center rounded-widget border border-border bg-secondary px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
        >
          取消
        </button>
      </div>
    </div>
  );
}
