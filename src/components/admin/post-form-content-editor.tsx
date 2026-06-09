"use client";

import {
  useMemo,
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from "react";
import { renderMarkdown } from "@/models/markdown";
import { ArticleBody } from "@/components/blog/article-body";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadZone, type UploadResult } from "./image-upload-zone";

export interface PostContentEditorHandle {
  /** Focus + scroll the textarea that's actually visible at the current
   *  viewport. Mobile and desktop each mount their own; this picks the one
   *  whose `offsetParent` is non-null (visible) and falls back to the other. */
  focusVisible: () => void;
}

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
 * Mobile and desktop each mount a separate Textarea (only one is visible at a
 * time via Tailwind responsive utilities). The parent uses the imperative
 * `focusVisible()` handle to focus whichever one the user actually sees on save
 * errors — without it, a shared ref would clobber to the last-mounted (desktop)
 * node and mobile errors would scroll to an invisible textarea.
 */
export const PostContentEditor = forwardRef<
  PostContentEditorHandle,
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

  const mobileRef = useRef<HTMLTextAreaElement>(null);
  const desktopRef = useRef<HTMLTextAreaElement>(null);
  /** When set, run focusVisible() once the mobile textarea remounts after we
   *  flip out of preview mode. Cleared by the effect below. */
  const pendingFocusRef = useRef(false);

  useEffect(() => {
    if (!pendingFocusRef.current) return;
    if (previewMode) return; // still in preview — wait for the next render
    pendingFocusRef.current = false;
    focusTargetTextarea();
  }, [previewMode]);

  const focusTargetTextarea = () => {
    // `offsetParent` is null when the element (or an ancestor) is
    // `display: none` — the canonical "is it visible?" check for hidden
    // siblings. Prefer the visible one; fall back to whichever is mounted.
    const candidates = [mobileRef.current, desktopRef.current];
    const visible = candidates.find(
      (el) => el !== null && el.offsetParent !== null,
    );
    const target = visible ?? candidates.find((el) => el !== null) ?? null;
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.focus({ preventScroll: true });
  };

  useImperativeHandle(
    ref,
    () => ({
      focusVisible: () => {
        // If the mobile editor is hidden because the user is in preview mode,
        // flip back to write first; the effect above runs focus after the
        // textarea remounts. Without this, focusVisible() falls back to the
        // (hidden) desktop textarea on mobile.
        if (previewMode) {
          pendingFocusRef.current = true;
          setPreviewMode(false);
          return;
        }
        focusTargetTextarea();
      },
    }),
    [previewMode],
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
        {/* Two labels: each htmlFor points at the textarea actually visible at
         *  its viewport, so clicking the label always focuses the editor the
         *  user sees. `id="content-label"` stays on the visible one so the
         *  mobile preview pane (which has no native label) can still reference
         *  it via aria-labelledby if we ever need to. */}
        <label
          id="content-label"
          htmlFor="content-mobile"
          className="text-sm font-medium text-foreground lg:hidden"
        >
          {"内容 (Markdown)"}
        </label>
        <label
          htmlFor="content-desktop"
          className="hidden text-sm font-medium text-foreground lg:block"
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
              ref={mobileRef}
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
          ref={desktopRef}
          id="content-desktop"
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


