"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Category, Tag, PostWithCategory, PostStatus } from "@/models/types";
import { slugify } from "@/models/post";
import { renderMarkdown } from "@/models/markdown";
import { ImageUploadZone } from "./image-upload-zone";
import { MarkdownPreview } from "./markdown-preview";
import { Select } from "@/components/ui/select";
import { ArticleBody } from "@/components/blog/article-body";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useLocale } from "@/i18n/context";

interface PostFormProps {
  post?: PostWithCategory & { tagIds: string[] };
  categories: Category[];
  tags: Tag[];
}

export function PostForm({ post, categories, tags }: PostFormProps) {
  const router = useRouter();
  const { t } = useLocale();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [status, setStatus] = useState<PostStatus>(post?.status ?? "draft");
  const [categoryId, setCategoryId] = useState(post?.category_id ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(
    post?.tagIds ?? [],
  );
  const [featuredImage, setFeaturedImage] = useState(
    post?.featured_image ?? "",
  );

  const isEditing = !!post;

  // AI excerpt generation
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGenerateExcerpt() {
    if (!post?.slug) return;
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/posts/${post.slug}/excerpt`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || t("admin.postForm.failedSave"));
        return;
      }
      const { excerpt: generated } = await res.json();
      setExcerpt(generated);
    } catch {
      alert(t("admin.postForm.failedSave"));
    } finally {
      setIsGenerating(false);
    }
  }

  // Markdown preview — tab mode for small screens
  const [previewMode, setPreviewMode] = useState(false);
  const previewHtml = useMemo(
    () => (previewMode && content ? renderMarkdown(content) : ""),
    [previewMode, content],
  );

  const handleTitleChange = (value: string) => {
    setTitle(value);
    // Auto-generate slug only for new posts or if slug hasn't been manually edited
    if (!isEditing && slug === slugify(title)) {
      setSlug(slugify(value));
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  const handleDelete = async () => {
    if (!post) return;
    if (!confirm(t("admin.postForm.confirmDelete", { title: post.title }))) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/posts/${post.slug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? t("admin.postForm.failedDelete"));
      }
      router.push("/admin/posts");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.postForm.failedDeleteGeneric"));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const body = {
        title,
        slug,
        content,
        excerpt: excerpt || undefined,
        status,
        category_id: categoryId || undefined,
        featured_image: featuredImage || undefined,
        tag_ids: selectedTags,
      };

      const url = isEditing
        ? `/api/posts/${post.slug}`
        : "/api/posts";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? t("admin.postForm.failedSave"));
      }

      router.push("/admin/posts");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.postForm.unknownError"));
    } finally {
      setSaving(false);
    }
  };

  // ── Shared form fields ──

  const editorFields = (
    <>
      {error && (
        <div className="rounded-[var(--radius-widget)] border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Title */}
      <div className="space-y-2">
        <label
          htmlFor="title"
          className="text-sm font-medium text-foreground"
        >
          {t("admin.postForm.title")}
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          required
          className="w-full rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={t("admin.postForm.titlePlaceholder")}
        />
      </div>

      {/* Slug */}
      <div className="space-y-2">
        <label
          htmlFor="slug"
          className="text-sm font-medium text-foreground"
        >
          {t("admin.postForm.slug")}
        </label>
        <input
          id="slug"
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          className="w-full rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={t("admin.postForm.slugPlaceholder")}
        />
      </div>

      {/* Content — Write / Preview tabs (mobile) or always-write (desktop) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            {t("admin.postForm.content")}
          </label>
          {/* Tab switcher — hidden on lg+ where preview is side-by-side */}
          <SegmentedControl
            options={[
              { value: "write", label: t("admin.postForm.write") },
              { value: "preview", label: t("admin.postForm.preview") },
            ]}
            value={previewMode ? "preview" : "write"}
            onChange={(v) => setPreviewMode(v === "preview")}
            className="lg:hidden"
          />
        </div>
        {/* Mobile: tab-based preview */}
        <div className="lg:hidden">
          {previewMode ? (
            <div className="blog-preview-theme min-h-[480px] rounded-[var(--radius-widget)] border border-border overflow-y-auto">
              {content ? (
                <ArticleBody html={previewHtml} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("admin.postForm.nothingToPreview")}
                </p>
              )}
            </div>
          ) : (
            <>
              <ImageUploadZone className="mb-2" />
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={20}
                className="w-full min-h-[480px] rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                placeholder={t("admin.postForm.contentPlaceholder")}
              />
            </>
          )}
        </div>
        {/* Desktop: always show editor (preview is in right panel) */}
        <div className="hidden lg:block">
          <ImageUploadZone className="mb-2" />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={20}
            className="w-full min-h-[480px] rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
            placeholder={t("admin.postForm.contentPlaceholder")}
          />
        </div>
      </div>

      {/* Excerpt */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label
            htmlFor="excerpt"
            className="text-sm font-medium text-foreground"
          >
            {t("admin.postForm.excerpt")}{" "}
            <span className="text-muted-foreground font-normal">
              {t("admin.postForm.excerptHint")}
            </span>
          </label>
          {isEditing && (
            <button
              type="button"
              onClick={handleGenerateExcerpt}
              disabled={isGenerating}
              className="text-xs text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
            >
              {isGenerating
                ? t("admin.postForm.excerptGenerating")
                : t("admin.postForm.excerptGenerate")}
            </button>
          )}
        </div>
        <textarea
          id="excerpt"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={3}
          className="w-full rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={t("admin.postForm.excerptPlaceholder")}
        />
      </div>

      {/* Row: Status + Category */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Status */}
        <div className="space-y-2">
          <label
            htmlFor="status"
            className="text-sm font-medium text-foreground"
          >
            {t("admin.postForm.status")}
          </label>
          <Select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as PostStatus)}
          >
            <option value="draft">{t("admin.postForm.statusDraft")}</option>
            <option value="published">{t("admin.postForm.statusPublished")}</option>
            <option value="private">{t("admin.postForm.statusPrivate")}</option>
            <option value="archived">{t("admin.postForm.statusArchived")}</option>
          </Select>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label
            htmlFor="category"
            className="text-sm font-medium text-foreground"
          >
            {t("admin.postForm.category")}
          </label>
          <Select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">{t("admin.postForm.noCategory")}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">{t("admin.postForm.tags")}</label>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
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
            <p className="text-sm text-muted-foreground">
              {t("admin.postForm.noTags")}
            </p>
          )}
        </div>
      </div>

      {/* Featured Image */}
      <div className="space-y-2">
        <label
          htmlFor="featured_image"
          className="text-sm font-medium text-foreground"
        >
          {t("admin.postForm.featuredImage")}{" "}
          <span className="text-muted-foreground font-normal">{t("admin.postForm.featuredImageHint")}</span>
        </label>
        <input
          id="featured_image"
          type="url"
          value={featuredImage}
          onChange={(e) => setFeaturedImage(e.target.value)}
          className="w-full rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="https://..."
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-[var(--radius-widget)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? t("admin.postForm.saving") : isEditing ? t("admin.postForm.updatePost") : t("admin.postForm.createPost")}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/posts")}
          className="inline-flex items-center rounded-[var(--radius-widget)] border border-border bg-secondary px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent"
        >
          {t("admin.postForm.cancel")}
        </button>
        {isEditing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="ml-auto inline-flex items-center rounded-[var(--radius-widget)] bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
          >
            {t("admin.postForm.deletePost")}
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="flex gap-6">
      {/* Left: Editor form */}
      <form
        onSubmit={handleSubmit}
        className="w-full space-y-6 lg:w-1/2 lg:min-w-0"
      >
        {editorFields}
      </form>

      {/* Right: Live preview — visible only on lg+ */}
      <div className="sticky top-14 hidden h-[calc(100vh-56px-24px)] w-1/2 min-w-0 overflow-y-auto rounded-[var(--radius-widget)] border border-border lg:block">
        <MarkdownPreview
          title={title}
          excerpt={excerpt}
          content={content}
          featuredImage={featuredImage}
        />
      </div>
    </div>
  );
}
