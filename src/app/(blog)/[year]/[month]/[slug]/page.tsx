import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, cache } from "react";
import Link from "next/link";
import Image from "next/image";
import { getDb } from "@/lib/db";
import { getPostBySlug, getPostTags } from "@/data/posts";
import { getSiteSettings } from "@/data/settings";
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
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";

// Deduplicate getPostBySlug across generateMetadata + page component
// within the same request. React cache() is per-request in server components.
const getCachedPost = cache((slug: string) => {
  const db = getDb();
  return getPostBySlug(db, slug, "published");
});

interface PostPageProps {
  params: Promise<{ year: string; month: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = getDb();
  const post = await getCachedPost(slug);

  if (!post) return { title: "Not Found" };

  const tags = await getPostTags(db, post.id);
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
    keywords: tags.map((t) => t.name),
  });
}

export default async function PostPage({ params }: PostPageProps) {
  const { year, month, slug } = await params;
  const db = getDb();
  const post = await getCachedPost(slug);

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

  const locale = await getLocale();
  const tags = await getPostTags(db, post.id);
  const settings = await getSiteSettings(db);
  const showComments = settings.commentsEnabled && !!post.comment_enabled;

  const html = post.content_html || renderMarkdown(post.content);
  const date = post.published_at
    ? formatDateDisplay(post.published_at)
    : t(locale, "blog.post.draft");

  const breadcrumbs = [
    { name: t(locale, "blog.post.home"), href: "/" },
    ...(post.category_name && post.category_slug
      ? [{ name: post.category_name, href: `/category/${post.category_slug}` }]
      : []),
    { name: post.title, href: postPath(post.slug, post.published_at) },
  ];

  const tagNames = tags.map((tg) => tg.name);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: blogPostingJsonLd(post, tagNames) }}
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
              <> · {t(locale, "blog.post.minRead", { n: post.reading_time })}</>
            )}
          </div>
        </header>

        {/* Featured image */}
        {post.featured_image && (
          <div className="blog-featured-image">
            <Image
              src={post.featured_image}
              alt=""
              fill
              sizes="(max-width: 900px) 100vw, min(75vw, 1000px)"
              priority
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
          <div className="mt-8">
            <div className="blog-tag-pills">
              {tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/tag/${tag.slug}`}
                  className="blog-tag-pill"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>

      {showComments && (
        <Suspense>
          <CommentsSection postId={post.id} locale={locale} />
        </Suspense>
      )}

      <nav className="mt-10 border-t border-blog-separator pt-6">
        <Link
          href="/"
          className="text-sm text-blog-muted transition-colors hover:text-blog-text"
        >
          {t(locale, "blog.post.backToAll")}
        </Link>
      </nav>
    </>
  );
}

// ---------------------------------------------------------------------------
// Async server component — loaded inside Suspense to keep article LCP fast
// ---------------------------------------------------------------------------

async function CommentsSection({
  postId,
  locale,
}: {
  postId: string;
  locale: import("@/i18n/translations").Locale;
}) {
  const db = getDb();
  const comments = await listCommentsByPost(db, postId);
  const tree = buildCommentTree(comments);
  return <Comments comments={tree} locale={locale} />;
}
