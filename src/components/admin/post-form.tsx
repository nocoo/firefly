"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Category, PostStatus, PostWithCategory, Tag } from "@/models/types";
import { slugify } from "@/models/post";
import type { UploadResult } from "./image-upload-zone";
import { MarkdownPreview } from "./markdown-preview";
import { ConfirmDialog } from "./confirm-dialog";
import { PostContentEditor, type PostContentEditorHandle } from "./post-form-content-editor";
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
  inferErrorField,
  type PostFormField,
} from "./post-form-helpers";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";

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
  /** General save error (when no specific field can be inferred). */
  const [error, setError] = useState<string | null>(null);
  /** Field-level error: which field is in error + the message to display. */
  const [fieldError, setFieldError] = useState<{
    field: PostFormField;
    message: string;
  } | null>(null);
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

  // ── Field refs (for scroll/focus on field-level errors) ──
  const titleRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<PostContentEditorHandle>(null);

  const focusField = (field: PostFormField) => {
    if (field === "content") {
      contentRef.current?.focusVisible();
      return;
    }
    const el = field === "title" ? titleRef.current : slugRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  };

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
    setFieldError(null);

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
        const errData = (await res.json()) as { error?: string };
        const message = errData.error ?? "保存文章失败";
        const field = inferErrorField(message);
        if (field) {
          setFieldError({ field, message });
          toast.error(message);
          // Defer to next tick so the field-level error renders first
          setTimeout(() => focusField(field), 0);
        } else {
          setError(message);
        }
        setSaving(false);
        return;
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
      <FormField
        id="title"
        label="标题"
        error={fieldError?.field === "title" ? fieldError.message : null}
      >
        <Input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          required
          placeholder="文章标题"
        />
      </FormField>

      {/* Slug */}
      <FormField
        id="slug"
        label="别名"
        error={fieldError?.field === "slug" ? fieldError.message : null}
      >
        <Input
          ref={slugRef}
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          placeholder="url-slug"
        />
      </FormField>

      <PostContentEditor
        ref={contentRef}
        content={content}
        onContentChange={setContent}
        uploadedMedia={uploadedMedia}
        onUploadedMediaChange={setUploadedMedia}
        error={fieldError?.field === "content" ? fieldError.message : null}
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
          {saving && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />}
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
