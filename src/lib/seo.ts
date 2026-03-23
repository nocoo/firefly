// ---------------------------------------------------------------------------
// SEO helpers — meta tag and structured data generation
// ---------------------------------------------------------------------------

import type { Metadata } from "next";

const SITE_NAME = "Li Zheng";
const SITE_URL = "https://lizheng.me";
const SITE_DESCRIPTION = "Personal blog by Li Zheng — technology, design, and life.";
const SITE_AUTHOR = "Li Zheng";
const TWITTER_HANDLE = "@nicnocquee";

export { SITE_NAME, SITE_URL, SITE_DESCRIPTION, SITE_AUTHOR, TWITTER_HANDLE };

// ---------------------------------------------------------------------------
// Page metadata builder
// ---------------------------------------------------------------------------

export interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  image?: string | undefined;
  type?: "website" | "article" | undefined;
  publishedTime?: string | undefined;
  modifiedTime?: string | undefined;
  keywords?: string[] | undefined;
}

export function buildPageMeta(input: PageMetaInput): Metadata {
  const url = `${SITE_URL}${input.path}`;
  const ogType = input.type ?? "website";

  return {
    title: input.title,
    description: input.description,
    authors: [{ name: SITE_AUTHOR, url: SITE_URL }],
    ...(input.keywords?.length ? { keywords: input.keywords } : {}),
    alternates: {
      canonical: url,
      languages: { "zh-CN": url },
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: SITE_NAME,
      locale: "zh_CN",
      type: ogType,
      ...(input.image ? { images: [{ url: input.image }] } : {}),
      ...(ogType === "article" && input.publishedTime
        ? {
            publishedTime: input.publishedTime,
            modifiedTime: input.modifiedTime,
            authors: [SITE_AUTHOR],
          }
        : {}),
    },
    twitter: {
      card: input.image ? "summary_large_image" : "summary",
      site: TWITTER_HANDLE,
      creator: TWITTER_HANDLE,
      title: input.title,
      description: input.description,
      ...(input.image ? { images: [input.image] } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/**
 * Format a unix epoch timestamp to YYYY-MM-DD.
 */
export function formatDate(epoch: number): string {
  const d = new Date(epoch * 1000);
  return d.toISOString().split("T")[0];
}

/**
 * Format a unix epoch timestamp to a display string like "Mar 22, 2026".
 */
export function formatDateDisplay(epoch: number): string {
  const d = new Date(epoch * 1000);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a unix epoch to ISO 8601 string for structured data.
 */
export function formatDateISO(epoch: number): string {
  return new Date(epoch * 1000).toISOString();
}

/**
 * Extract year and month from unix epoch for URL path.
 * Returns { year: "2026", month: "03" }
 */
export function extractYearMonth(epoch: number): { year: string; month: string } {
  const d = new Date(epoch * 1000);
  return {
    year: d.getFullYear().toString(),
    month: (d.getMonth() + 1).toString().padStart(2, "0"),
  };
}

/**
 * Build the public URL path for a post.
 * /YYYY/MM/slug
 */
export function postPath(slug: string, publishedAt: number | null): string {
  if (!publishedAt) return `/${slug}`;
  const { year, month } = extractYearMonth(publishedAt);
  return `/${year}/${month}/${slug}`;
}
