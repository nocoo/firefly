"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Category, Tag, PostWithCategory, PostStatus } from "@/models/types";
import { slugify } from "@/models/post";
import { renderMarkdown } from "@/models/markdown";
import { postPath } from "@/lib/seo";
import { ImageUploadZone } from "./image-upload-zone";
import { MarkdownPreview } from "./markdown-preview";
import { ConfirmDialog } from "./confirm-dialog";
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

  // Reference URL state
  const [referenceUrl, setReferenceUrl] = useState(post?.reference_url ?? "");
  const [referenceTitle, setReferenceTitle] = useState(post?.reference_title ?? "");
  const [referenceDescription, setReferenceDescription] = useState(post?.reference_description ?? "");
  const [referenceImage, setReferenceImage] = useState(post?.reference_image ?? "");
  const [isUnfurling, setIsUnfurling] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [bodyText, setBodyText] = useState("");
  const [hasFetched, setHasFetched] = useState(!!(post?.reference_title || post?.reference_description));

  const isEditing = !!post;

  // Frontend URL for "View Post" link
  const frontendUrl = isEditing && post.published_at
    ? postPath(post.slug, post.published_at)
    : null;

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
        toast.error(data.error || t("admin.postForm.failedSave"));
        return;
      }
      const { excerpt: generated } = await res.json();
      setExcerpt(generated ?? "");
    } catch {
      toast.error(t("admin.postForm.failedSave"));
    } finally {
      setIsGenerating(false);
    }
  }

  // Reference URL unfurl
  async function handleUnfurl() {
    if (!referenceUrl.trim()) return;
    setIsUnfurling(true);
    try {
      const res = await fetch("/api/unfurl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: referenceUrl.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || t("admin.postForm.failedSave"));
        return;
      }
      const data = await res.json();
      setReferenceTitle(data.title ?? "");
      setReferenceDescription(data.description ?? "");
      setReferenceImage(data.image ?? "");
      setBodyText(data.bodyText ?? "");
      setHasFetched(true);
    } catch {
      toast.error(t("admin.postForm.failedSave"));
    } finally {
      setIsUnfurling(false);
    }
  }

  function handleClearReference() {
    setReferenceUrl("");
    setReferenceTitle("");
    setReferenceDescription("");
    setReferenceImage("");
    setBodyText("");
    setHasFetched(false);
  }

  // AI-enhance reference title + description
  async function handleEnhanceReference() {
    setIsEnhancing(true);
    try {
      const res = await fetch("/api/unfurl/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: referenceTitle,
          description: referenceDescription,
          bodyText,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || t("admin.postForm.failedSave"));
        return;
      }
      const data = await res.json();
      if (data.title) setReferenceTitle(data.title);
      if (data.description) setReferenceDescription(data.description);
    } catch {
      toast.error(t("admin.postForm.failedSave"));
    } finally {
      setIsEnhancing(false);
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

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const handleDelete = async () => {
    if (!post) return;
    setDeleteConfirmOpen(false);

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
        ...(isEditing
          ? {
              // Update: null clears, undefined omits.
              // When URL is empty, clear all 4 reference fields to avoid orphan metadata.
              reference_url: referenceUrl || null,
              reference_title: referenceUrl ? (referenceTitle || null) : null,
              reference_description: referenceUrl ? (referenceDescription || null) : null,
              reference_image: referenceUrl ? (referenceImage || null) : null,
            }
          : {
              // Create: undefined omits (defaults to NULL in DB)
              reference_url: referenceUrl || undefined,
              reference_title: referenceUrl ? (referenceTitle || undefined) : undefined,
              reference_description: referenceUrl ? (referenceDescription || undefined) : undefined,
              reference_image: referenceUrl ? (referenceImage || undefined) : undefined,
            }),
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

  // ── Main content column (Title + Content editor) ──

  const mainColumn = (
    <div className="space-y-4">
      {error && (
        <div className="rounded-[var(--radius-widget)] border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Title with View Post button */}
      <div className="space-y-2">
        <label
          htmlFor="title"
          className="text-sm font-medium text-foreground"
        >
          {t("admin.postForm.title")}
        </label>
        <div className="flex gap-2">
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            required
            className="flex-1 rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={t("admin.postForm.titlePlaceholder")}
          />
          {isEditing && frontendUrl && (
            <a
              href={frontendUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-4">
                <path d="M8.914 2.586a2 2 0 1 1 2.828 2.828l-3 3a2 2 0 0 1-2.828 0 .75.75 0 0 0-1.06 1.06 3.5 3.5 0 0 0 4.95 0l3-3a3.5 3.5 0 0 0-4.95-4.95l-1.5 1.5a.75.75 0 1 0 1.06 1.06l1.5-1.5Z" />
                <path d="M7.086 13.414a2 2 0 1 1-2.828-2.828l3-3a2 2 0 0 1 2.828 0 .75.75 0 0 0 1.06-1.06 3.5 3.5 0 0 0-4.95 0l-3 3a3.5 3.5 0 0 0 4.95 4.95l1.5-1.5a.75.75 0 0 0-1.06-1.06l-1.5 1.5Z" />
              </svg>
              <span className="hidden sm:inline">{t("admin.postForm.viewPost")}</span>
            </a>
          )}
        </div>
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
        {/* Desktop: always show editor (preview is in separate panel) */}
        <div className="hidden lg:block">
          <ImageUploadZone className="mb-2" />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={24}
            className="w-full min-h-[560px] rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
            placeholder={t("admin.postForm.contentPlaceholder")}
          />
        </div>
      </div>
    </div>
  );

  // ── Sidebar column (metadata + actions) ──

  const sidebarColumn = (
    <div className="space-y-5">
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

      {/* Tags */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">{t("admin.postForm.tags")}</label>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
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

      {/* Reference URL */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          {t("admin.postForm.referenceUrl")}{" "}
          <span className="text-muted-foreground font-normal">{t("admin.postForm.referenceUrlHint")}</span>
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={referenceUrl}
            onChange={(e) => setReferenceUrl(e.target.value)}
            className="flex-1 min-w-0 rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="https://..."
          />
          <button
            type="button"
            onClick={handleUnfurl}
            disabled={isUnfurling || !referenceUrl.trim()}
            className="shrink-0 inline-flex items-center rounded-[var(--radius-widget)] border border-border bg-secondary px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            {isUnfurling
              ? t("admin.postForm.fetching")
              : hasFetched
                ? t("admin.postForm.refetch")
                : t("admin.postForm.fetch")}
          </button>
          {(referenceUrl || hasFetched) && (
            <button
              type="button"
              onClick={handleClearReference}
              className="shrink-0 inline-flex items-center rounded-[var(--radius-widget)] border border-border bg-secondary px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              {t("admin.postForm.clear")}
            </button>
          )}
        </div>
        {hasFetched && (
          <div className="space-y-2 rounded-[var(--radius-widget)] border border-border p-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">{t("admin.postForm.referenceTitle")}</label>
                <button
                  type="button"
                  onClick={handleEnhanceReference}
                  disabled={isEnhancing}
                  className="text-xs text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
                >
                  {isEnhancing
                    ? t("admin.postForm.enhancing")
                    : t("admin.postForm.aiEnhance")}
                </button>
              </div>
              <input
                type="text"
                value={referenceTitle}
                onChange={(e) => setReferenceTitle(e.target.value)}
                className="w-full rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("admin.postForm.referenceDescription")}</label>
              <textarea
                value={referenceDescription}
                onChange={(e) => setReferenceDescription(e.target.value)}
                rows={2}
                className="w-full rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {referenceImage && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t("admin.postForm.referenceImage")}</label>
                <img
                  src={referenceImage}
                  alt={referenceTitle || "Reference"}
                  className="h-20 w-auto rounded object-cover"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions — pinned at bottom of sidebar */}
      <div className="space-y-3 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 rounded-[var(--radius-widget)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? t("admin.postForm.saving") : isEditing ? t("admin.postForm.updatePost") : t("admin.postForm.createPost")}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/admin/posts")}
            className="flex-1 inline-flex items-center justify-center rounded-[var(--radius-widget)] border border-border bg-secondary px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent"
          >
            {t("admin.postForm.cancel")}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center rounded-[var(--radius-widget)] bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              {t("admin.postForm.deletePost")}
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {isEditing && (
        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title={post ? t("admin.postForm.confirmDelete", { title: post.title }) : ""}
          description=""
          destructive
          confirmLabel={t("admin.confirm.delete")}
          cancelLabel={t("admin.confirm.cancel")}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      {/* Mobile: single column stacked */}
      <div className="space-y-6 lg:hidden">
        {mainColumn}
        {sidebarColumn}
      </div>

      {/* Desktop: 3-column layout — Main (3fr) | Sidebar (2fr) | Preview */}
      <div className="hidden lg:flex lg:gap-6">
        {/* Main content area — 3/5 of the form space */}
        <div className="min-w-0 flex-[3]">
          {mainColumn}
        </div>

        {/* Settings sidebar — 2/5 of the form space */}
        <div className="min-w-0 flex-[2]">
          <div className="sticky top-14 max-h-[calc(100vh-56px-24px)] overflow-y-auto">
            {sidebarColumn}
          </div>
        </div>

        {/* Live preview — visible only on xl+ */}
        <div className="sticky top-14 hidden h-[calc(100vh-56px-24px)] min-w-0 flex-[2] overflow-y-auto rounded-[var(--radius-widget)] border border-border xl:block">
          <MarkdownPreview
            title={title}
            excerpt={excerpt}
            content={content}
            featuredImage={featuredImage}
            referenceUrl={referenceUrl}
            referenceTitle={referenceTitle}
            referenceDescription={referenceDescription}
            referenceImage={referenceImage}
          />
        </div>
      </div>
    </form>
  );
}
