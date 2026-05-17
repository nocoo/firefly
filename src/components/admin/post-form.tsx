"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Category, PostStatus, PostWithCategory, Tag } from "@/models/types";
import { slugify } from "@/models/post";
import { type UploadResult } from "./image-upload-zone";
import { MarkdownPreview } from "./markdown-preview";
import { ConfirmDialog } from "./confirm-dialog";
import { PostContentEditor } from "./post-form-content-editor";
import {
  PostExcerptField,
  PostFeaturedImageField,
  PostPublishDateField,
  PostStatusCategoryRow,
  PostTagsField,
} from "./post-form-fields";
import {
  PostReferenceFields,
  type ReferenceState,
} from "./post-form-reference-fields";
import {
  buildSubmitBody,
  epochToDatetimeLocal,
} from "./post-form-helpers";

interface PostFormProps {
  post?: PostWithCategory & { tagIds: string[] };
  categories: Category[];
  tags: Tag[];
}

/** Preload media records for an existing post, merging with anything the
 *  user already uploaded before the response arrived. */
function useMediaPreload(
  postId: string | undefined,
  setMedia: React.Dispatch<React.SetStateAction<UploadResult[]>>,
) {
  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    fetch(`/api/media?post_id=${postId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.media) return;
        const preloaded: UploadResult[] = data.media.map(
          (m: { id: string; url: string; filename: string }) => ({
            id: m.id,
            url: m.url,
            filename: m.filename,
          }),
        );
        setMedia((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const newItems = preloaded.filter((r) => !existingIds.has(r.id));
          return [...prev, ...newItems];
        });
      })
      .catch(() => {
        // Silently ignore — preload is best-effort
      });
    return () => {
      cancelled = true;
    };
  }, [postId, setMedia]);
}

/** Associate uploaded media with a freshly created post (best-effort). */
async function associateMedia(
  mediaIds: string[],
  postId: string,
): Promise<void> {
  try {
    const res = await fetch("/api/media/associate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaIds, postId }),
    });
    if (!res.ok) {
      toast.error("文章已保存，但未能关联上传的图片。可从媒体库手动关联。");
    }
  } catch {
    toast.error("文章已保存，但未能关联上传的图片。可从媒体库手动关联。");
  }
}

export function PostForm({ post, categories, tags }: PostFormProps) {
  const router = useRouter();
  const isEditing = !!post;

  // ── Form state ──
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [status, setStatus] = useState<PostStatus>(post?.status ?? "draft");
  const [categoryId, setCategoryId] = useState(post?.category_id ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(post?.tagIds ?? []);
  const [featuredImage, setFeaturedImage] = useState(post?.featured_image ?? "");
  const [publishedAtLocal, setPublishedAtLocal] = useState(() =>
    epochToDatetimeLocal(post?.published_at),
  );

  // Reference state (compound)
  const [reference, setReference] = useState<ReferenceState>({
    url: post?.reference_url ?? "",
    title: post?.reference_title ?? "",
    description: post?.reference_description ?? "",
    image: post?.reference_image ?? "",
  });
  const [hasFetched, setHasFetched] = useState(
    !!(post?.reference_title || post?.reference_description),
  );

  // ── Shared upload state ──
  const [uploadedMedia, setUploadedMedia] = useState<UploadResult[]>([]);
  useMediaPreload(post?.id, setUploadedMedia);

  // ── Delete confirmation ──
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

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
    setDeleteConfirmOpen(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/posts/${post.slug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "删除文章失败");
      }
      router.push("/admin/posts");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const body = buildSubmitBody({
        isEditing,
        title,
        slug,
        content,
        excerpt,
        status,
        categoryId,
        featuredImage,
        selectedTags,
        publishedAtLocal,
        reference,
      });

      const url = isEditing ? `/api/posts/${post.slug}` : "/api/posts";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? "保存文章失败");
      }

      // Backfill post_id on media uploaded during new post creation
      if (!isEditing && uploadedMedia.length > 0) {
        const responseData = await res.json();
        const newPostId = responseData.id as string | undefined;
        if (newPostId) {
          await associateMedia(
            uploadedMedia.map((r) => r.id),
            newPostId,
          );
        }
      }

      router.push("/admin/posts");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setSaving(false);
    }
  };

  const editorFields = (
    <>
      {error && (
        <div className="rounded-widget border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Title */}
      <div className="space-y-2">
        <label htmlFor="title" className="text-sm font-medium text-foreground">
          标题
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          required
          className="w-full rounded-widget border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="文章标题"
        />
      </div>

      {/* Slug */}
      <div className="space-y-2">
        <label htmlFor="slug" className="text-sm font-medium text-foreground">
          {"别名"}
        </label>
        <input
          id="slug"
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          className="w-full rounded-widget border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={"url-slug"}
        />
      </div>

      <PostContentEditor
        content={content}
        onContentChange={setContent}
        uploadedMedia={uploadedMedia}
        onUploadedMediaChange={setUploadedMedia}
        {...(post?.id ? { postId: post.id } : {})}
      />

      <PostExcerptField
        excerpt={excerpt}
        onExcerptChange={setExcerpt}
        {...(isEditing && post ? { postSlug: post.slug } : {})}
      />

      <PostStatusCategoryRow
        status={status}
        onStatusChange={setStatus}
        categoryId={categoryId}
        onCategoryChange={setCategoryId}
        categories={categories}
      />

      <PostPublishDateField
        value={publishedAtLocal}
        onChange={setPublishedAtLocal}
      />

      <PostTagsField
        tags={tags}
        selectedTags={selectedTags}
        onToggleTag={toggleTag}
      />

      <PostFeaturedImageField
        value={featuredImage}
        onChange={setFeaturedImage}
      />

      <PostReferenceFields
        state={reference}
        hasFetched={hasFetched}
        onChange={setReference}
        onHasFetchedChange={setHasFetched}
      />

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-widget bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "保存中..." : isEditing ? "更新文章" : "创建文章"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/posts")}
          className="inline-flex items-center rounded-widget border border-border bg-secondary px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent"
        >
          {"取消"}
        </button>
        {isEditing && (
          <button
            type="button"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={saving}
            className="ml-auto inline-flex items-center rounded-widget bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
          >
            {"删除文章"}
          </button>
        )}
      </div>

      {isEditing && (
        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title={post ? `确认删除「${title}」？此操作不可撤销。` : ""}
          description=""
          destructive
          confirmLabel={"删除"}
          cancelLabel={"取消"}
          onConfirm={handleDelete}
        />
      )}
    </>
  );

  return (
    <div className="flex gap-6">
      <form
        onSubmit={handleSubmit}
        className="w-full space-y-6 lg:w-1/2 lg:min-w-0"
      >
        {editorFields}
      </form>

      {/* Right: Live preview — visible only on lg+ */}
      <div className="sticky top-0 hidden h-[calc(100vh-var(--header-height)-12px-40px)] w-1/2 min-w-0 overflow-y-auto rounded-widget border border-border lg:block">
        <MarkdownPreview
          title={title}
          excerpt={excerpt}
          content={content}
          featuredImage={featuredImage}
          referenceUrl={reference.url}
          referenceTitle={reference.title}
          referenceDescription={reference.description}
          referenceImage={reference.image}
        />
      </div>
    </div>
  );
}
