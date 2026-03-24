// ---------------------------------------------------------------------------
// SEO helpers — meta tag and structured data generation
// ---------------------------------------------------------------------------

import type { Metadata } from "next";
import type { Locale } from "@/i18n/translations";

const SITE_NAME = "LIZHENG.ME";
const SITE_URL = "https://lizheng.me";
const SITE_DESCRIPTION = "知白守黑，不语万千算 — Li Zheng's personal blog on technology, design, and life.";
const SITE_AUTHOR = "Li Zheng";
const TWITTER_HANDLE = "@zhengli";

export { SITE_NAME, SITE_URL, SITE_DESCRIPTION, SITE_AUTHOR, TWITTER_HANDLE };

// ---------------------------------------------------------------------------
// Locale → SEO format mapping
// ---------------------------------------------------------------------------

/** Map internal locale to OpenGraph locale (underscore format). */
export function ogLocale(locale: Locale): string {
  return locale === "zh" ? "zh_CN" : "en_US";
}

/** Map internal locale to BCP 47 language tag (hyphen format). */
export function htmlLang(locale: Locale): string {
  return locale === "zh" ? "zh-CN" : "en";
}

// ---------------------------------------------------------------------------
// Page metadata builder
// ---------------------------------------------------------------------------

export interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  locale?: Locale | undefined;
  image?: string | undefined;
  type?: "website" | "article" | undefined;
  publishedTime?: string | undefined;
  modifiedTime?: string | undefined;
  keywords?: string[] | undefined;
}

export function buildPageMeta(input: PageMetaInput): Metadata {
  const url = `${SITE_URL}${input.path}`;
  const ogType = input.type ?? "website";
  const locale = input.locale ?? "zh";
  const lang = htmlLang(locale);

  return {
    title: input.title,
    description: input.description,
    authors: [{ name: SITE_AUTHOR, url: SITE_URL }],
    ...(input.keywords?.length ? { keywords: input.keywords } : {}),
    alternates: {
      canonical: url,
      languages: { [lang]: url },
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: SITE_NAME,
      locale: ogLocale(locale),
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
