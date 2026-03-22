import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { getPostBySlug, getPostTags } from "@/data/posts";
import { renderMarkdown } from "@/models/markdown";
import {
  buildPageMeta,
  formatDateDisplay,
  formatDateISO,
  postPath,
} from "@/lib/seo";

interface PostPageProps {
  params: Promise<{ year: string; month: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = getDb();
  const post = await getPostBySlug(db, slug);

  if (!post) return { title: "Not Found" };

  const path = postPath(post.slug, post.published_at);

  return buildPageMeta({
    title: post.title,
    description: post.excerpt ?? "",
    path,
    image: post.featured_image ?? undefined,
    type: "article",
    publishedTime: post.published_at
      ? formatDateISO(post.published_at)
      : undefined,
    modifiedTime: formatDateISO(post.updated_at),
  });
}

export default async function PostPage({ params }: PostPageProps) {
  const { year, month, slug } = await params;
  const db = getDb();
  const post = await getPostBySlug(db, slug);

  if (!post) notFound();

  // Verify URL matches the post's actual date
  if (post.published_at) {
    const d = new Date(post.published_at * 1000);
    const expectedYear = d.getFullYear().toString();
    const expectedMonth = (d.getMonth() + 1).toString().padStart(2, "0");
    if (year !== expectedYear || month !== expectedMonth) {
      notFound();
    }
  }

  const tags = await getPostTags(db, post.id);
  const html = renderMarkdown(post.content);
  const date = post.published_at
    ? formatDateDisplay(post.published_at)
    : "Draft";

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <article>
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <time
              dateTime={
                post.published_at
                  ? new Date(post.published_at * 1000).toISOString()
                  : undefined
              }
            >
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
        </header>

        <div
          className="prose dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {tags.length > 0 && (
          <footer className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800">
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/tag/${tag.slug}`}
                  className="inline-block px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          </footer>
        )}
      </article>

      <nav className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800">
        <Link
          href="/"
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          ← Back to all posts
        </Link>
      </nav>
    </main>
  );
}
