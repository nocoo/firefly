import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Calendar, User } from "lucide-react";
import type { PostWithAgent } from "@/models/types";
import { postPath, formatDateDisplay } from "@/lib/seo";
import { t, type Locale } from "@/i18n/translations";
import { sanitizeSnippet } from "@/lib/sanitize-snippet";

export interface PostCardAuthor {
  name: string;
  avatarUrl: string | null;
}

interface PostCardProps {
  post: PostWithAgent;
  locale: Locale;
  /** Author info for the byline (name + optional avatar) */
  author?: PostCardAuthor;
  /** Mark the featured image as high-priority (LCP) */
  priority?: boolean;
  /** FTS5 HTML snippet with <mark> tags — overrides excerpt when provided */
  snippet?: string;
}

export function PostCard({ post, locale, author, priority, snippet }: PostCardProps) {
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
          prefetch={false}
          className="text-blog-text no-underline transition-colors hover:text-blog-accent"
        >
          {post.title}
        </Link>
      </h2>

      {/* Byline */}
      <div className="blog-byline">
        <span className="blog-byline-item">
          <Calendar className="blog-byline-icon" />
          <span>{t(locale, "blog.post.published")}</span>{" "}
          {post.published_at ? (
            <time dateTime={new Date(post.published_at * 1000).toISOString()}>
              {date}
            </time>
          ) : (
            <span>{date}</span>
          )}
        </span>
        {author && (
          <span className="blog-byline-item">
            {author.avatarUrl ? (
              <Image
                src={author.avatarUrl}
                alt={author.name}
                width={16}
                height={16}
                className="blog-byline-avatar"
              />
            ) : (
              <User className="blog-byline-icon" />
            )}
            <span>{author.name}</span>
          </span>
        )}
      </div>

      {/* Featured image */}
      {post.featured_image && (
        <div className="blog-featured-image">
          <Link href={href} prefetch={false} className="absolute inset-0" aria-label={post.title}>
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

      {/* Excerpt — snippet overrides when provided */}
      {(snippet || post.excerpt) && (
        snippet
          ? <p className="mt-3 text-base leading-relaxed text-blog-text"
               dangerouslySetInnerHTML={{ __html: sanitizeSnippet(snippet) }} />
          : <p className="mt-3 text-base leading-relaxed text-blog-text">
              {post.excerpt}
            </p>
      )}

      {/* Continue reading link */}
      {(snippet || post.excerpt) && (
        <Link
          href={href}
          prefetch={false}
          className="blog-read-more"
          aria-label={`${t(locale, "blog.post.continueReading")} — ${post.title}`}
        >
          {t(locale, "blog.post.continueReading")}
          <ArrowRight className="ml-1 inline h-4 w-4" />
        </Link>
      )}
    </article>
  );
}
