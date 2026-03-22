"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Category, Tag, PostWithCategory } from "@/models/types";
import { slugify } from "@/models/post";

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
  const [status, setStatus] = useState(post?.status ?? "draft");
  const [categoryId, setCategoryId] = useState(post?.category_id ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(
    post?.tagIds ?? [],
  );
  const [featuredImage, setFeaturedImage] = useState(
    post?.featured_image ?? "",
  );

  const isEditing = !!post;

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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      {/* Content */}
      <div className="space-y-2">
        <label
          htmlFor="content"
          className="text-sm font-medium text-foreground"
        >
          Content (Markdown)
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={20}
          className="w-full rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
          placeholder="Write your post content in Markdown..."
        />
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
            onChange={(e) => setStatus(e.target.value)}
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
      </div>
    </form>
  );
}
