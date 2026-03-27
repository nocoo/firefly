import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getPostById, getPostTags } from "@/data/posts";
import { renderMarkdown } from "@/models/markdown";
import { ArticleBody } from "@/components/blog/article-body";
import { ContentImageLightbox } from "@/components/blog/content-image-lightbox";
import { ReferenceCard } from "@/components/blog/reference-card";
import { formatDateDisplay } from "@/lib/seo";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface PreviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function PreviewPage({ params }: PreviewPageProps) {
  // Auth gate — only logged-in admins can preview
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const db = getDb();
  const post = await getPostById(db, id);

  if (!post) notFound();

  const locale = await getLocale();
  const tags = await getPostTags(db, post.id);
  const html = renderMarkdown(post.content, { optimizeImages: true });
  const date = post.published_at
    ? formatDateDisplay(post.published_at, locale)
    : t(locale, "blog.post.draft");

  return (
    <>
      {/* Preview banner */}
      <div className="mb-6 rounded-[var(--radius-widget)] border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">
        Preview Mode — This post is <strong>{post.status}</strong>.
        {" "}
        <Link
          href={`/admin/posts/${post.id}/edit`}
          className="underline hover:no-underline"
        >
          Edit
        </Link>
      </div>

      <ArticleBody
        html={html}
        header={
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
              {post.category_name && (
                <> · {post.category_name}</>
              )}
              {post.reading_time && (
                <> · {t(locale, "blog.post.minRead", { n: post.reading_time })}</>
              )}
            </div>
          </header>
        }
        featuredImage={
          post.featured_image ? (
            <div className="blog-featured-image">
              <Image
                src={post.featured_image}
                alt={post.title}
                fill
                sizes="(max-width: 900px) 100vw, min(75vw, 1000px)"
                priority
              />
            </div>
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
                  <span key={tag.id} className="blog-tag-pill">
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          ) : undefined
        }
      />
      <ContentImageLightbox />
    </>
  );
}
