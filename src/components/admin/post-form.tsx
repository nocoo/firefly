"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { Category, Tag, PostWithCategory, PostStatus } from "@/models/types";
import { slugify } from "@/models/post";
import { renderMarkdown } from "@/models/markdown";
import { ImageUpload } from "./image-upload";
import { MarkdownPreview } from "./markdown-preview";

interface PostFormProps {
  post?: PostWithCategory & { tagIds: string[] };
  categories: Category[];
  tags: Tag[];
}

export function PostForm({ post, categories, tags }: PostFormProps) {
  const router = useRouter();
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

  // Markdown preview — tab mode for small screens
  const [previewMode, setPreviewMode] = useState(false);
  const previewHtml = useMemo(
    () => (previewMode && content ? renderMarkdown(content) : ""),
    [previewMode, content],
  );

  // Insert uploaded image URL as markdown at cursor (or end)
  const handleImageUpload = useCallback((url: string) => {
    const markdown = `![](${url})`;
    setContent((prev) => (prev ? `${prev}\n\n${markdown}` : markdown));
  }, []);

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
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/posts/${post.slug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete post");
      }
      router.push("/admin/posts");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
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
        throw new Error(data.error ?? "Failed to save post");
      }

      router.push("/admin/posts");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
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
          Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          required
          className="w-full rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Post title"
        />
      </div>

      {/* Slug */}
      <div className="space-y-2">
        <label
          htmlFor="slug"
          className="text-sm font-medium text-foreground"
        >
          Slug
        </label>
        <input
          id="slug"
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          className="w-full rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="url-slug"
        />
      </div>

      {/* Content — Write / Preview tabs (mobile) or always-write (desktop) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            Content (Markdown)
          </label>
          {/* Tab switcher — hidden on lg+ where preview is side-by-side */}
          <div className="flex rounded-[var(--radius-widget)] border border-border bg-secondary p-0.5 lg:hidden">
            <button
              type="button"
              onClick={() => setPreviewMode(false)}
              className={`rounded-[calc(var(--radius-widget)-2px)] px-3 py-1 text-xs font-medium transition-colors ${
                !previewMode
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode(true)}
              className={`rounded-[calc(var(--radius-widget)-2px)] px-3 py-1 text-xs font-medium transition-colors ${
                previewMode
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Preview
            </button>
          </div>
        </div>
        {/* Mobile: tab-based preview */}
        <div className="lg:hidden">
          {previewMode ? (
            <div className="min-h-[480px] rounded-[var(--radius-widget)] border border-border bg-secondary px-4 py-3 overflow-y-auto">
              {content ? (
                <div
                  className="prose-firefly prose dark:prose-invert max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nothing to preview
                </p>
              )}
            </div>
          ) : (
            <>
              <ImageUpload onUpload={handleImageUpload} className="mb-2" />
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={20}
                className="w-full min-h-[480px] rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                placeholder="Write your post content in Markdown..."
              />
            </>
          )}
        </div>
        {/* Desktop: always show editor (preview is in right panel) */}
        <div className="hidden lg:block">
          <ImageUpload onUpload={handleImageUpload} className="mb-2" />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={20}
            className="w-full min-h-[480px] rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
            placeholder="Write your post content in Markdown..."
          />
        </div>
      </div>

      {/* Excerpt */}
      <div className="space-y-2">
        <label
          htmlFor="excerpt"
          className="text-sm font-medium text-foreground"
        >
          Excerpt{" "}
          <span className="text-muted-foreground font-normal">
            (optional, auto-generated if empty)
          </span>
        </label>
        <textarea
          id="excerpt"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={3}
          className="w-full rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Brief description of the post..."
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
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as PostStatus)}
            className="w-full rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="private">Private</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label
            htmlFor="category"
            className="text-sm font-medium text-foreground"
          >
            Category
          </label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">No category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Tags</label>
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
              No tags available
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
          Featured Image URL{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
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
          {saving ? "Saving..." : isEditing ? "Update Post" : "Create Post"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/posts")}
          className="inline-flex items-center rounded-[var(--radius-widget)] border border-border bg-secondary px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent"
        >
          Cancel
        </button>
        {isEditing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="ml-auto inline-flex items-center rounded-[var(--radius-widget)] bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
          >
            Delete Post
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
      <div className="sticky top-14 hidden h-[calc(100vh-56px-24px)] w-1/2 min-w-0 overflow-y-auto rounded-[var(--radius-widget)] border border-border bg-secondary p-6 lg:block">
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
