import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { getPostBySlug, getPostTags } from "@/data/posts";
import { listCommentsByPost, buildCommentTree } from "@/data/comments";
import { renderMarkdown } from "@/models/markdown";
import {
  buildPageMeta,
  formatDateDisplay,
  formatDateISO,
  postPath,
} from "@/lib/seo";
import { blogPostingJsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { Comments } from "@/components/blog/comments";

interface PostPageProps {
  params: Promise<{ year: string; month: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = getDb();
  const post = await getPostBySlug(db, slug, "published");

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
  const post = await getPostBySlug(db, slug, "published");

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

  // Load comments only for posts with comments enabled
  let commentTree: Awaited<ReturnType<typeof buildCommentTree>> = [];
  if (post.comment_enabled) {
    const comments = await listCommentsByPost(db, post.id);
    commentTree = buildCommentTree(comments);
  }

  const html = renderMarkdown(post.content);
  const date = post.published_at
    ? formatDateDisplay(post.published_at)
    : "Draft";

  const breadcrumbs = [
    { name: "Home", href: "/" },
    ...(post.category_name && post.category_slug
      ? [{ name: post.category_name, href: `/category/${post.category_slug}` }]
      : []),
    { name: post.title, href: postPath(post.slug, post.published_at) },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: blogPostingJsonLd(post) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd(breadcrumbs) }}
      />

      <article>
        {/* Post header */}
        <header>
          <h1 className="text-2xl font-bold leading-tight text-blog-text md:text-3xl">
            {post.title}
          </h1>
          <div className="blog-byline">
            <time
              dateTime={
                post.published_at
                  ? new Date(post.published_at * 1000).toISOString()
                  : undefined
              }
            >
              Published {date}
            </time>
            {post.category_name && post.category_slug && (
              <>
                {" in "}
                <Link href={`/category/${post.category_slug}`}>
                  {post.category_name}
                </Link>
              </>
            )}
            {post.reading_time && (
              <> &middot; {post.reading_time} min read</>
            )}
          </div>
        </header>

        {/* Featured image */}
        {post.featured_image && (
          <div className="blog-featured-image">
            <img
              src={post.featured_image}
              alt={post.title}
            />
          </div>
        )}

        {/* Post content */}
        <div
          className="blog-content prose-firefly prose dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Tags */}
        {tags.length > 0 && (
          <footer className="mt-8 border-t border-blog-separator pt-6">
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/tag/${tag.slug}`}
                  className="inline-block rounded-full bg-blog-separator px-3 py-1 text-xs text-blog-muted transition-colors hover:text-blog-text"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          </footer>
        )}
      </article>

      <Comments comments={commentTree} />

      <nav className="mt-8 border-t border-blog-separator pt-6">
        <Link
          href="/"
          className="text-sm text-blog-muted transition-colors hover:text-blog-text"
        >
          &larr; Back to all posts
        </Link>
      </nav>
    </>
  );
}
