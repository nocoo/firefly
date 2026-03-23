"use client";

import { useMemo } from "react";
import { renderMarkdown } from "@/models/markdown";
import { useLocale } from "@/i18n/context";

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
    <article className="mx-auto max-w-2xl">
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
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground md:text-3xl">
          {title}
        </h1>
      )}

      {/* Subtitle / excerpt */}
      {excerpt && (
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {excerpt}
        </p>
      )}

      {/* Divider */}
      {(title || excerpt) && content && (
        <hr className="my-6 border-border" />
      )}

      {/* Content */}
      {content && (
        <div
          className="prose-firefly prose dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </article>
  );
}
