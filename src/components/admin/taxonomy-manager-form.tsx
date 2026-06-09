"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { validateSlug, formatSlugError } from "@/lib/slug-validation";

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
  existingSlugs,
  currentSlug,
  onChange,
  onSave,
  onCancel,
}: {
  label: string;
  editing: boolean;
  state: TaxonomyFormState;
  saving: boolean;
  /** All taxonomy slugs in scope — used for duplicate detection on blur. */
  existingSlugs?: ReadonlySet<string>;
  /** When editing, exclude the row's own slug from duplicate detection so
   *  re-saving without changes doesn't flag itself. */
  currentSlug?: string;
  onChange: (next: TaxonomyFormState) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [slugError, setSlugError] = useState<string | null>(null);

  const checkSlug = () => {
    if (!existingSlugs) {
      setSlugError(null);
      return;
    }
    const peers = new Set(existingSlugs);
    if (currentSlug) peers.delete(currentSlug);
    const err = validateSlug(state.slug, peers);
    setSlugError(err ? formatSlugError(err) : null);
  };

  return (
    <div className="rounded-widget border border-border bg-secondary/50 p-4 space-y-3">
      <h3 className="text-sm font-medium text-foreground">
        {editing ? `编辑${label}` : `新建${label}`}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="taxonomy-name" label="名称" className="space-y-1">
          <Input
            type="text"
            value={state.name}
            onChange={(e) => onChange({ ...state, name: e.target.value })}
            placeholder="名称"
          />
        </FormField>
        <FormField
          id="taxonomy-slug"
          label="别名"
          className="space-y-1"
          error={slugError}
        >
          <Input
            type="text"
            value={state.slug}
            onChange={(e) => {
              onChange({ ...state, slug: e.target.value });
              // Clear the error as soon as the user starts typing again — they
              // are actively fixing it; re-validate on next blur.
              if (slugError) setSlugError(null);
            }}
            onBlur={checkSlug}
            placeholder="别名"
          />
        </FormField>
      </div>
      <FormField
        id="taxonomy-description"
        label="描述（可选）"
        className="space-y-1"
      >
        <Input
          type="text"
          value={state.description}
          onChange={(e) => onChange({ ...state, description: e.target.value })}
          placeholder="描述（可选）"
        />
      </FormField>
      <div className="flex gap-2">
        <Button onClick={onSave} disabled={saving || !!slugError} size="sm">
          {saving ? "保存中..." : "保存"}
        </Button>
        <Button onClick={onCancel} variant="outline" size="sm">
          取消
        </Button>
      </div>
    </div>
  );
}
