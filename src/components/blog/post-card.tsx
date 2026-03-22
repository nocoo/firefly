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
    <article className="py-6 border-b border-gray-200 dark:border-gray-800 last:border-0">
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-2">
        <time dateTime={post.published_at ? new Date(post.published_at * 1000).toISOString() : undefined}>
          {date}
        </time>
        {post.category_name && post.category_slug && (
          <>
            <span>·</span>
            <Link
              href={`/category/${post.category_slug}`}
              className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              {post.category_name}
            </Link>
          </>
        )}
        {post.reading_time && (
          <>
            <span>·</span>
            <span>{post.reading_time} min read</span>
          </>
        )}
      </div>

      <h2 className="text-xl font-semibold mb-2">
        <Link
          href={href}
          className="text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {post.title}
        </Link>
      </h2>

      {post.excerpt && (
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
          {post.excerpt}
        </p>
      )}
    </article>
  );
}
