"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Category, PostStatus, Tag } from "@/models/types";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

// ---------------------------------------------------------------------------
// Excerpt field with optional AI generation
// ---------------------------------------------------------------------------

export function PostExcerptField({
  excerpt,
  onExcerptChange,
  postSlug,
}: {
  excerpt: string;
  onExcerptChange: (next: string) => void;
  postSlug?: string;
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!postSlug) return;
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/posts/${postSlug}/excerpt`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "保存文章失败");
        return;
      }
      const { excerpt: generated } = await res.json();
      onExcerptChange(generated ?? "");
    } catch {
      toast.error("保存文章失败");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label htmlFor="excerpt" className="text-sm font-medium text-foreground">
          {"摘要"}{" "}
          <span className="text-muted-foreground font-normal">
            {"（可选，留空则自动生成）"}
          </span>
        </label>
        {postSlug && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
            {isGenerating ? "生成中..." : "AI 生成"}
          </button>
        )}
      </div>
      <Textarea
        id="excerpt"
        value={excerpt}
        onChange={(e) => onExcerptChange(e.target.value)}
        rows={3}
        placeholder={"文章的简要描述..."}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status + Category selectors (single row)
// ---------------------------------------------------------------------------

export function PostStatusCategoryRow({
  status,
  onStatusChange,
  categoryId,
  onCategoryChange,
  categories,
}: {
  status: PostStatus;
  onStatusChange: (next: PostStatus) => void;
  categoryId: string;
  onCategoryChange: (next: string) => void;
  categories: Category[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <label htmlFor="status" className="text-sm font-medium text-foreground">
          {"状态"}
        </label>
        <Select
          id="status"
          value={status}
          onChange={(e) => onStatusChange(e.target.value as PostStatus)}
        >
          <option value="draft">{"草稿"}</option>
          <option value="published">{"已发布"}</option>
          <option value="private">{"私密"}</option>
          <option value="archived">{"已归档"}</option>
        </Select>
      </div>

      <div className="space-y-2">
        <label htmlFor="category" className="text-sm font-medium text-foreground">
          {"分类"}
        </label>
        <Select
          id="category"
          value={categoryId}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="">{"无分类"}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Publish date picker
// ---------------------------------------------------------------------------

export function PostPublishDateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor="published_at"
        className="text-sm font-medium text-foreground"
      >
        {"发布日期"}{" "}
        <span className="text-muted-foreground font-normal">
          {"（留空则首次发布时自动设置）"}
        </span>
      </label>
      <input
        id="published_at"
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full sm:w-auto rounded-widget border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tag chips selector
// ---------------------------------------------------------------------------

export function PostTagsField({
  tags,
  selectedTags,
  onToggleTag,
}: {
  tags: Tag[];
  selectedTags: string[];
  onToggleTag: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{"标签"}</label>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => onToggleTag(tag.id)}
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedTags.includes(tag.id)
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {tag.name}
          </button>
        ))}
        {tags.length === 0 && (
          <p className="text-sm text-muted-foreground">{"暂无标签"}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Featured image URL field
// ---------------------------------------------------------------------------

export function PostFeaturedImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor="featured_image"
        className="text-sm font-medium text-foreground"
      >
        {"封面图片 URL"}{" "}
        <span className="text-muted-foreground font-normal">{"（可选）"}</span>
      </label>
      <Input
        id="featured_image"
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://..."
      />
    </div>
  );
}
