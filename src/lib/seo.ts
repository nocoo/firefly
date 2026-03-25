// ---------------------------------------------------------------------------
// SEO helpers — meta tag and structured data generation
// ---------------------------------------------------------------------------

import type { Metadata } from "next";
import type { Locale } from "@/i18n/translations";

/**
 * Site URL — read from AUTH_URL env var (deployment-level config).
 * This is the only site identity value that stays as an env var rather
 * than in the DB, because it must be available at build/start time.
 */
export const SITE_URL = process.env.AUTH_URL ?? "http://localhost:3000";

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

export function buildPageMeta(
  input: PageMetaInput,
  site: SiteIdentity,
): Metadata {
  const url = `${SITE_URL}${input.path}`;
  const ogType = input.type ?? "website";
  const locale = input.locale ?? "zh";
  const lang = htmlLang(locale);

  return {
    title: input.title,
    description: input.description,
    authors: [{ name: site.siteAuthor, url: SITE_URL }],
    ...(input.keywords?.length ? { keywords: input.keywords } : {}),
    alternates: {
      canonical: url,
      languages: { [lang]: url },
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: site.siteName,
      locale: ogLocale(locale),
      type: ogType,
      ...(input.image ? { images: [{ url: input.image }] } : {}),
      ...(ogType === "article" && input.publishedTime
        ? {
            publishedTime: input.publishedTime,
            modifiedTime: input.modifiedTime,
            authors: [site.siteAuthor],
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
