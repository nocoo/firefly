"use client";

import { useMemo, useState, useCallback } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { renderMarkdown } from "@/models/markdown";
import { useLocale } from "@/i18n/context";
import { ArticleBody } from "@/components/blog/article-body";
import { ReferenceCard } from "@/components/blog/reference-card";

interface MarkdownPreviewProps {
  title?: string;
  excerpt?: string;
  content: string;
  featuredImage?: string;
  referenceUrl?: string;
  referenceTitle?: string;
  referenceDescription?: string;
  referenceImage?: string;
}

export function MarkdownPreview({
  title,
  excerpt,
  content,
  featuredImage,
  referenceUrl,
  referenceTitle,
  referenceDescription,
  referenceImage,
}: MarkdownPreviewProps) {
  const html = useMemo(
    () => (content ? renderMarkdown(content) : ""),
    [content],
  );
  const { t } = useLocale();

  // Sync preview theme with global dark mode on mount
  const { resolvedTheme } = useTheme();
  const [previewDark, setPreviewDark] = useState(resolvedTheme === "dark");
  const togglePreviewTheme = useCallback(() => setPreviewDark((d) => !d), []);

  const isEmpty = !title && !excerpt && !content && !featuredImage && !referenceUrl;

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
    <div
      className={`blog-preview-theme relative${previewDark ? " blog-preview-dark dark" : ""}`}
    >
      {/* Scoped theme toggle — top-right */}
      <button
        type="button"
        onClick={togglePreviewTheme}
        className="blog-preview-toggle"
        aria-label={previewDark ? t("theme.light") : t("theme.dark")}
      >
        {previewDark ? (
          <Sun className="h-3.5 w-3.5" strokeWidth={1.5} />
        ) : (
          <Moon className="h-3.5 w-3.5" strokeWidth={1.5} />
        )}
      </button>

      <ArticleBody
        html={html}
        referenceCard={
          referenceUrl ? (
            <ReferenceCard
              url={referenceUrl}
              title={referenceTitle}
              description={referenceDescription}
              image={referenceImage}
            />
          ) : undefined
        }
        header={
          <>
            {featuredImage && (
              <div className="mb-8 overflow-hidden rounded-[var(--radius-widget)]">
                <img
                  src={featuredImage}
                  alt={title || t("admin.preview.featuredImageAlt")}
                  className="w-full object-cover"
                />
              </div>
            )}

            {title && (
              <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">
                {title}
              </h1>
            )}

            {excerpt && (
              <p className="mt-3 text-base leading-relaxed opacity-60">
                {excerpt}
              </p>
            )}

            {(title || excerpt) && content && (
              <hr className="my-6 border-[var(--blog-separator)]" />
            )}
          </>
        }
      />
    </div>
  );
}
