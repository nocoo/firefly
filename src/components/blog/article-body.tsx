import type { ReactNode } from "react";

interface ArticleBodyProps {
  /** Pre-rendered HTML from renderMarkdown() */
  html: string;
  /** Optional header to render above content (title, byline, etc.) */
  header?: ReactNode;
  /** Optional featured image element */
  featuredImage?: ReactNode;
  /** Optional reference URL card — renders between featured image and content */
  referenceCard?: ReactNode;
  /** Optional footer to render below content (tags, etc.) */
  footer?: ReactNode;
  /** Extra class names on the outermost wrapper */
  className?: string;
}

/**
 * Shared article renderer — used by both the public blog post page
 * and the admin preview panel.
 *
 * Wraps content in the blog theme (colors + typography) so the
 * rendered output is pixel-identical regardless of context.
 */
export function ArticleBody({
  html,
  header,
  featuredImage,
  referenceCard,
  footer,
  className,
}: ArticleBodyProps) {
  return (
    <article className={className}>
      {header}
      {featuredImage}
      {referenceCard}
      {html ? (
        <div
          className="blog-content prose-firefly prose max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}
      {footer}
    </article>
  );
}
