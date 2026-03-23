import Link from "next/link";
import type { PostWithCategory } from "@/models/types";
import { postPath, formatDateDisplay } from "@/lib/seo";

interface PostCardProps {
  post: PostWithCategory;
}

export function PostCard({ post }: PostCardProps) {
  const href = postPath(post.slug, post.published_at);
  const date = post.published_at ? formatDateDisplay(post.published_at) : "Draft";

  return (
    <article className="blog-entry">
      {/* Post title */}
      <h2 className="text-lg font-semibold leading-snug md:text-xl">
        <Link
          href={href}
          className="text-blog-text no-underline transition-colors hover:text-blog-accent"
        >
          {post.title}
        </Link>
      </h2>

      {/* Byline */}
      <div className="blog-byline">
        <time dateTime={post.published_at ? new Date(post.published_at * 1000).toISOString() : undefined}>
          {date}
        </time>
        {post.category_name && post.category_slug && (
          <>
            {" · "}
            <Link href={`/category/${post.category_slug}`}>
              {post.category_name}
            </Link>
          </>
        )}
        {post.reading_time && (
          <> · {post.reading_time} min read</>
        )}
      </div>

      {/* Featured image */}
      {post.featured_image && (
        <div className="blog-featured-image">
          <Link href={href}>
            <img
              src={post.featured_image}
              alt={post.title}
            />
          </Link>
        </div>
      )}

      {/* Excerpt */}
      {post.excerpt && (
        <p className="mt-2 text-sm leading-relaxed text-blog-muted">
          {post.excerpt}
        </p>
      )}
    </article>
  );
}
