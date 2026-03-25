import Link from "next/link";
import Image from "next/image";
import type { PostWithCategory } from "@/models/types";
import { postPath, formatDateDisplay } from "@/lib/seo";
import { t, type Locale } from "@/i18n/translations";

interface PostCardProps {
  post: PostWithCategory;
  locale: Locale;
  /** Author name for the byline */
  author?: string;
  /** Mark the featured image as high-priority (LCP) */
  priority?: boolean;
}

export function PostCard({ post, locale, author, priority }: PostCardProps) {
  const href = postPath(post.slug, post.published_at);
  const date = post.published_at
    ? formatDateDisplay(post.published_at, locale)
    : t(locale, "blog.post.draft");

  return (
    <article className="blog-entry">
      {/* Post title */}
      <h2 className="text-xl font-semibold leading-snug md:text-2xl">
        <Link
          href={href}
          className="text-blog-text no-underline transition-colors hover:text-blog-accent"
        >
          {post.title}
        </Link>
      </h2>

      {/* Byline */}
      <div className="blog-byline">
        <span>{t(locale, "blog.post.published")}</span>{" "}
        <time dateTime={post.published_at ? new Date(post.published_at * 1000).toISOString() : undefined}>
          {date}
        </time>
        {" "}<span>{t(locale, "blog.post.byAuthor", { author: author || "" })}</span>
      </div>

      {/* Featured image */}
      {post.featured_image && (
        <div className="blog-featured-image">
          <Link href={href} className="absolute inset-0">
            <Image
              src={post.featured_image}
              alt={post.title}
              fill
              sizes="(max-width: 900px) 100vw, min(75vw, 1000px)"
              priority={priority ?? false}
              {...(priority ? { fetchPriority: "high" as const } : {})}
            />
          </Link>
        </div>
      )}

      {/* Excerpt */}
      {post.excerpt && (
        <Link href={href} className="mt-3 block text-base leading-relaxed text-blog-text no-underline">
          {post.excerpt}
        </Link>
      )}

      {/* Continue reading link */}
      {post.excerpt && (
        <Link
          href={href}
          className="blog-read-more"
        >
          {t(locale, "blog.post.continueReading")}
        </Link>
      )}
    </article>
  );
}
