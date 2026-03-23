// ---------------------------------------------------------------------------
// JSON-LD structured data generators
// ---------------------------------------------------------------------------

import type { PostWithCategory } from "@/models/types";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, postPath, formatDateISO } from "./seo";

// ---------------------------------------------------------------------------
// WebSite (home page)
// ---------------------------------------------------------------------------

export function websiteJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: "zh-CN",
    author: {
      "@type": "Person",
      name: "Li Zheng",
      url: SITE_URL,
    },
  });
}

// ---------------------------------------------------------------------------
// BlogPosting (post detail)
// ---------------------------------------------------------------------------

export function blogPostingJsonLd(
  post: PostWithCategory,
  tagNames?: string[],
): string {
  const url = `${SITE_URL}${postPath(post.slug, post.published_at)}`;

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
    inLanguage: "zh-CN",
    ...(post.featured_image ? { image: post.featured_image } : {}),
    author: {
      "@type": "Person",
      name: "Li Zheng",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Person",
      name: "Li Zheng",
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
