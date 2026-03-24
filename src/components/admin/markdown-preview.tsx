"use client";

import { useMemo } from "react";
import { renderMarkdown } from "@/models/markdown";
import { useLocale } from "@/i18n/context";
import { ArticleBody } from "@/components/blog/article-body";

interface MarkdownPreviewProps {
  title?: string;
  excerpt?: string;
  content: string;
  featuredImage?: string;
}

export function MarkdownPreview({
  title,
  excerpt,
  content,
  featuredImage,
}: MarkdownPreviewProps) {
  const html = useMemo(
    () => (content ? renderMarkdown(content) : ""),
    [content],
  );
  const { t } = useLocale();

  const isEmpty = !title && !excerpt && !content && !featuredImage;

  if (isEmpty) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {t("admin.preview.emptyState")}
        </p>
      </div>
    );
  }

  return (
    <div className="blog-preview-theme mx-auto max-w-2xl">
      <ArticleBody
        html={html}
        header={
          <>
            {/* Featured image */}
            {featuredImage && (
              <div className="mb-8 overflow-hidden rounded-[var(--radius-widget)]">
                <img
                  src={featuredImage}
                  alt={title || t("admin.preview.featuredImageAlt")}
                  className="w-full object-cover"
                />
              </div>
            )}

            {/* Title */}
            {title && (
              <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">
                {title}
              </h1>
            )}

            {/* Subtitle / excerpt */}
            {excerpt && (
              <p className="mt-3 text-base leading-relaxed opacity-60">
                {excerpt}
              </p>
            )}

            {/* Divider */}
            {(title || excerpt) && content && (
              <hr className="my-6 border-[var(--blog-separator)]" />
            )}
          </>
        }
      />
    </div>
  );
}
