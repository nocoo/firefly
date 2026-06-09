import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, cache } from "react";
import Link from "next/link";
import Image from "next/image";
import { getDb } from "@/lib/db";
import { getPostBySlug, getPostTags, getAdjacentPosts } from "@/data/entities/post";
import { getSiteSettings } from "@/data/settings";
import { isAdminSession } from "@/lib/auth";
import { listCommentsByPost, buildCommentTree } from "@/data/entities/comment";
import { FeaturedImage } from "@/components/blog/featured-image";
import { renderMarkdown } from "@/models/markdown";
import { Calendar, Folder, Clock, SquarePen, User } from "lucide-react";
import {
  buildPageMeta,
  formatDateDisplay,
  formatDateISO,
  postPath,
  SITE_URL,
} from "@/lib/seo";
import { blogPostingJsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { Comments } from "@/components/blog/comments";
import { ArticleBody } from "@/components/blog/article-body";
import { ContentImageLightbox } from "@/components/blog/content-image-lightbox";
import { ReferenceCard } from "@/components/blog/reference-card";
import { ArticleNav } from "@/components/blog/article-nav";
import { ReadingProgress } from "@/components/blog/reading-progress";
import { getPostAuthor, getPostAuthorForMeta } from "@/lib/ai-agent/author";

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

  const [tags, settings] = await Promise.all([
    getPostTags(db, post.id),
    getSiteSettings(db),
  ]);

  // Resolve author (agent or site author) - now synchronous with JOINed data
  const authorMeta = getPostAuthorForMeta(post, settings, SITE_URL);
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
    // Only set authorOverride if it's an agent (different from site author)
    authorOverride: authorMeta.name !== settings.siteAuthor ? authorMeta : undefined,
  }, settings);
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

  const tags = await getPostTags(db, post.id);
  const settings = await getSiteSettings(db);
  const isAdmin = await isAdminSession();
  const showComments = settings.commentsEnabled && !!post.comment_enabled;

  // Resolve author (agent or site owner) - now synchronous with JOINed data
  const author = getPostAuthor(post, settings);

  // Adjacent posts for keyboard navigation
  const adjacent = post.published_at
    ? await getAdjacentPosts(db, post.published_at, post.id)
    : { prev: null, next: null };
  const prevHref = adjacent.prev
    ? postPath(adjacent.prev.slug, adjacent.prev.published_at)
    : null;
  const nextHref = adjacent.next
    ? postPath(adjacent.next.slug, adjacent.next.published_at)
    : null;

  const html = renderMarkdown(post.content, { optimizeImages: true, postTitle: post.title });
  const date = post.published_at
    ? formatDateDisplay(post.published_at)
    : "草稿";

  const breadcrumbs = [
    { name: "首页", href: "/" },
    ...(post.category_name && post.category_slug
      ? [{ name: post.category_name, href: `/category/${post.category_slug}` }]
      : []),
    { name: post.title, href: postPath(post.slug, post.published_at) },
  ];

  const tagNames = tags.map((tg) => tg.name);

  // JSON-LD always has author now (either agent or site owner)
  const jsonLdAuthor = { name: author.name };

  return (
    <>
      <ReadingProgress />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: blogPostingJsonLd(post, settings, tagNames, jsonLdAuthor) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd(breadcrumbs) }}
      />

      <ArticleBody
        html={html}
        header={
          <header>
            <h1 className="text-2xl font-bold leading-tight text-blog-text md:text-3xl">
              {post.title}
            </h1>
            <div className="blog-byline">
              <span className="blog-byline-item">
                {author.avatarUrl ? (
                  <Image
                    src={author.avatarUrl}
                    alt={author.name}
                    width={20}
                    height={20}
                    className="blog-byline-avatar"
                  />
                ) : (
                  <User className="blog-byline-icon" strokeWidth={1.5} />
                )}
                <span>{author.name}</span>
              </span>
              <span className="blog-byline-item">
                <Calendar className="blog-byline-icon" strokeWidth={1.5} />
                <time
                  dateTime={
                    post.published_at
                      ? new Date(post.published_at * 1000).toISOString()
                      : undefined
                  }
                >
                  {date}
                </time>
              </span>
              {post.category_name && post.category_slug && (
                <span className="blog-byline-item">
                  <Folder className="blog-byline-icon" strokeWidth={1.5} />
                  <Link href={`/category/${post.category_slug}`} prefetch={false}>
                    {post.category_name}
                  </Link>
                </span>
              )}
              {post.reading_time && (
                <span className="blog-byline-item">
                  <Clock className="blog-byline-icon" strokeWidth={1.5} />
                  {`${post.reading_time} 分钟阅读`}
                </span>
              )}
              {isAdmin && (
                <Link
                  href={`/admin/posts/${post.id}/edit`}
                  className="blog-byline-item blog-byline-edit"
                >
                  <SquarePen className="blog-byline-icon" strokeWidth={1.5} />
                  编辑
                </Link>
              )}
            </div>
          </header>
        }
        featuredImage={
          post.featured_image ? (
            <FeaturedImage
              src={post.featured_image}
              alt={post.title}
              priority
            />
          ) : undefined
        }
        referenceCard={
          post.reference_url ? (
            <ReferenceCard
              url={post.reference_url}
              title={post.reference_title}
              description={post.reference_description}
              image={post.reference_image}
            />
          ) : undefined
        }
        footer={
          tags.length > 0 ? (
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
          ) : undefined
        }
      />
      <ContentImageLightbox />

      {showComments && (
        <Suspense>
          <CommentsSection postId={post.id} isAdmin={isAdmin} />
        </Suspense>
      )}

      <ArticleNav
        prevHref={prevHref}
        prevTitle={adjacent.prev?.title ?? null}
        nextHref={nextHref}
        nextTitle={adjacent.next?.title ?? null}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Async server component — loaded inside Suspense to keep article LCP fast
// ---------------------------------------------------------------------------

async function CommentsSection({
  postId,
  isAdmin,
}: {
  postId: string;
  isAdmin: boolean;
}) {
  const db = getDb();
  const comments = await listCommentsByPost(db, postId);
  const tree = buildCommentTree(comments);
  return <Comments comments={tree} isAdmin={isAdmin} />;
}
