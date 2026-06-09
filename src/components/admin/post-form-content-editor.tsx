"use client";

import { useMemo, useState } from "react";
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
}

/**
 * Content editor: textarea + image upload zone, with a mobile Write/Preview tab
 * switcher and a desktop layout that delegates the preview to the right column.
 */
export function PostContentEditor({
  content,
  onContentChange,
  uploadedMedia,
  onUploadedMediaChange,
  postId,
}: PostContentEditorProps) {
  const [previewMode, setPreviewMode] = useState(false);
  const previewHtml = useMemo(
    () => (previewMode && content ? renderMarkdown(content) : ""),
    [previewMode, content],
  );

  const uploadProps = postId ? { postId } : {};

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          id="content-label"
          htmlFor="content"
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
              id="content"
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              required
              rows={20}
              className="min-h-[480px] font-mono"
              placeholder={"使用 Markdown 编写文章内容..."}
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
          aria-labelledby="content-label"
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          required
          rows={20}
          className="min-h-[480px] font-mono"
          placeholder={"使用 Markdown 编写文章内容..."}
        />
      </div>
    </div>
  );
}
