// ---------------------------------------------------------------------------
// SEO helpers — meta tag and structured data generation
// ---------------------------------------------------------------------------

import type { Metadata } from "next";

/**
 * Site URL — read from AUTH_URL env var (deployment-level config).
 * This is the only site identity value that stays as an env var rather
 * than in the DB, because it must be available at build/start time.
 */
export const SITE_URL = process.env.AUTH_URL ?? "http://localhost:3000";

/** OpenGraph locale (underscore format). */
export const OG_LOCALE = "zh_CN";

/** BCP 47 language tag (hyphen format). */
export const HTML_LANG = "zh-CN";

/**
 * Subset of SiteSettings needed by SEO helpers.
 * Avoids circular dependency with data layer.
 */
export interface SiteIdentity {
  siteName: string;
  siteTagline: string;
  siteDescription: string;
  siteAuthor: string;
  authorEmail: string;
  twitterHandle: string;
}

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
  /** Override the default site author (for AI agent posts). */
  authorOverride?: { name: string; url: string } | undefined;
}

export function buildPageMeta(
  input: PageMetaInput,
  site: SiteIdentity,
): Metadata {
  const url = `${SITE_URL}${input.path}`;
  const ogType = input.type ?? "website";

  // Use authorOverride if provided, otherwise fall back to site author
  const author = input.authorOverride ?? { name: site.siteAuthor, url: SITE_URL };

  return {
    title: input.title,
    description: input.description,
    authors: [author],
    ...(input.keywords?.length ? { keywords: input.keywords } : {}),
    alternates: {
      canonical: url,
      languages: { [HTML_LANG]: url },
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: site.siteName,
      locale: OG_LOCALE,
      type: ogType,
      ...(input.image ? { images: [{ url: input.image }] } : {}),
      ...(ogType === "article" && input.publishedTime
        ? {
            publishedTime: input.publishedTime,
            modifiedTime: input.modifiedTime,
            authors: [author.name],
          }
        : {}),
    },
    twitter: {
      card: input.image ? "summary_large_image" : "summary",
      ...(site.twitterHandle ? { site: site.twitterHandle } : {}),
      ...(site.twitterHandle ? { creator: site.twitterHandle } : {}),
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
 * Format a unix epoch timestamp to a display string.
 * 中文格式："2026年3月22日"
 */
export function formatDateDisplay(epoch: number): string {
  const d = new Date(epoch * 1000);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
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
