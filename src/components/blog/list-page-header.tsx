import type { ReactNode } from "react";

interface ListPageHeaderProps {
  title: ReactNode;
  /** Description / count line below the title. Optional. */
  description?: ReactNode;
}

/**
 * Shared header for blog list pages (category, tag, archive).
 *
 * Unifies the h1 size + leading + description treatment so the five list
 * surfaces stop drifting apart. Search page keeps its own header (controlled
 * via globals.css `.blog-search-results h1`).
 */
export function ListPageHeader({ title, description }: ListPageHeaderProps) {
  return (
    <header className="journal-list-header mb-8">
      <p className="journal-eyebrow" lang="en"><span /> FROM THE COLLECTION</p>
      <h1 className="text-2xl font-bold leading-tight text-blog-text md:text-3xl">
        {title}
      </h1>
      {description && (
        <p className="mt-1 text-sm text-blog-muted">{description}</p>
      )}
    </header>
  );
}
