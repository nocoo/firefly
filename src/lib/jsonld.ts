// ---------------------------------------------------------------------------
// JSON-LD structured data generators
// ---------------------------------------------------------------------------

import type { PostWithCategory } from "@/models/types";
import type { Locale } from "@/i18n/translations";
import type { SiteIdentity } from "./seo";
import { SITE_URL, postPath, formatDateISO, htmlLang } from "./seo";

// ---------------------------------------------------------------------------
// WebSite (home page)
// ---------------------------------------------------------------------------

export function websiteJsonLd(site: SiteIdentity, locale: Locale = "zh"): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.siteName,
    url: SITE_URL,
    description: site.siteDescription,
    inLanguage: htmlLang(locale),
    author: {
      "@type": "Person",
      name: site.siteAuthor,
      url: SITE_URL,
    },
  });
}

// ---------------------------------------------------------------------------
// BlogPosting (post detail)
// ---------------------------------------------------------------------------

export interface BlogPostingAuthor {
  name: string;
  url?: string;
}

export function blogPostingJsonLd(
  post: PostWithCategory,
  site: SiteIdentity,
  tagNames?: string[],
  locale: Locale = "zh",
  authorOverride?: BlogPostingAuthor,
): string {
  const url = `${SITE_URL}${postPath(post.slug, post.published_at)}`;
  const author = authorOverride ?? { name: site.siteAuthor, url: SITE_URL };

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    url,
    datePublished: post.published_at
      ? formatDateISO(post.published_at)
      : formatDateISO(post.created_at),
    dateModified: formatDateISO(post.updated_at),
    description: post.excerpt ?? "",
    inLanguage: htmlLang(locale),
    ...(post.featured_image ? { image: post.featured_image } : {}),
    author: {
      "@type": "Person",
      name: author.name,
      ...(author.url ? { url: author.url } : {}),
    },
    publisher: {
      "@type": "Person",
      name: site.siteAuthor,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    ...(post.reading_time
      ? { timeRequired: `PT${post.reading_time}M` }
      : {}),
    ...(post.category_name
      ? { articleSection: post.category_name }
      : {}),
    ...(tagNames?.length ? { keywords: tagNames.join(", ") } : {}),
  });
}

// ---------------------------------------------------------------------------
// BreadcrumbList
// ---------------------------------------------------------------------------

export interface BreadcrumbItem {
  name: string;
  href: string;
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.href}`,
    })),
  });
}

// ---------------------------------------------------------------------------
// CollectionPage + ItemList (listing pages: category, tag, archive, home)
// ---------------------------------------------------------------------------

export interface CollectionItem {
  url: string;
  name: string;
}

export function collectionPageJsonLd(
  name: string,
  path: string,
  items: CollectionItem[],
  locale: Locale = "zh",
): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url: `${SITE_URL}${path}`,
    inLanguage: htmlLang(locale),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: item.url,
        name: item.name,
      })),
    },
  });
}
