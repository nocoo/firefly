"use client";

import { useMemo, useState, forwardRef } from "react";
import { renderMarkdown } from "@/models/markdown";
import { ArticleBody } from "@/components/blog/article-body";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadZone, type UploadResult } from "./image-upload-zone";

interface PostContentEditorProps {
  content: string;
  onContentChange: (next: string) => void;
  uploadedMedia: UploadResult[];
  onUploadedMediaChange: React.Dispatch<React.SetStateAction<UploadResult[]>>;
  postId?: string;
  /** Field-level error message — when set, the textareas render in error
   *  state with `aria-invalid` and link to the error <p> via aria-describedby. */
  error?: string | null;
}

/**
 * Content editor: textarea + image upload zone, with a mobile Write/Preview tab
 * switcher and a desktop layout that delegates the preview to the right column.
 *
 * The forwarded ref points at the *currently visible* textarea — desktop on
 * `lg+`, mobile otherwise. The parent uses it to focus/scroll on save errors.
 * Mobile and desktop textareas need distinct DOM ids; the shared label uses
 * `htmlFor="content-mobile"` (only one is in the document at a time on small
 * screens), and the desktop variant relies on `aria-labelledby="content-label"`.
 */
export const PostContentEditor = forwardRef<
  HTMLTextAreaElement,
  PostContentEditorProps
>(function PostContentEditor(
  {
    content,
    onContentChange,
    uploadedMedia,
    onUploadedMediaChange,
    postId,
    error,
  },
  ref,
) {
  const [previewMode, setPreviewMode] = useState(false);
  const previewHtml = useMemo(
    () => (previewMode && content ? renderMarkdown(content) : ""),
    [previewMode, content],
  );

  const uploadProps = postId ? { postId } : {};
  const errorId = error ? "content-error" : undefined;
  const editorClassName = error
    ? "min-h-[480px] font-mono border-destructive"
    : "min-h-[480px] font-mono";
  const ariaInvalidProp = error ? { "aria-invalid": true as const } : {};
  const ariaDescribedByProp = errorId ? { "aria-describedby": errorId } : {};

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          id="content-label"
          htmlFor="content-mobile"
          className="text-sm font-medium text-foreground"
        >
          {"内容 (Markdown)"}
        </label>
        {/* Tab switcher — hidden on lg+ where preview is side-by-side */}
        <SegmentedControl
          options={[
            { value: "write", label: "编辑" },
            { value: "preview", label: "预览" },
          ]}
          value={previewMode ? "preview" : "write"}
          onChange={(v) => setPreviewMode(v === "preview")}
          className="lg:hidden"
        />
      </div>

      {/* Mobile: tab-based preview */}
      <div className="lg:hidden">
        {previewMode ? (
          <div className="blog-preview-theme min-h-[480px] rounded-widget border border-border overflow-y-auto">
            {content ? (
              <ArticleBody html={previewHtml} />
            ) : (
              <p className="text-sm text-muted-foreground">{"暂无内容可预览"}</p>
            )}
          </div>
        ) : (
          <>
            <ImageUploadZone
              className="mb-2"
              results={uploadedMedia}
              onResultsChange={onUploadedMediaChange}
              {...uploadProps}
            />
            <Textarea
              ref={ref}
              id="content-mobile"
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              required
              rows={20}
              className={editorClassName}
              placeholder={"使用 Markdown 编写文章内容..."}
              {...ariaInvalidProp}
              {...ariaDescribedByProp}
            />
          </>
        )}
      </div>

      {/* Desktop: always show editor (preview is in right panel) */}
      <div className="hidden lg:block">
        <ImageUploadZone
          className="mb-2"
          results={uploadedMedia}
          onResultsChange={onUploadedMediaChange}
          {...uploadProps}
        />
        <Textarea
          ref={ref}
          id="content-desktop"
          aria-labelledby="content-label"
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          required
          rows={20}
          className={editorClassName}
          placeholder={"使用 Markdown 编写文章内容..."}
          {...ariaInvalidProp}
          {...ariaDescribedByProp}
        />
      </div>

      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
});

