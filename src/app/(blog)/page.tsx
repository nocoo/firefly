import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { listPosts } from "@/data/posts";
import { PostCard } from "@/components/blog/post-card";
import { Pagination } from "@/components/blog/pagination";
import { SITE_NAME, SITE_DESCRIPTION, buildPageMeta } from "@/lib/seo";
import { websiteJsonLd } from "@/lib/jsonld";

const PAGE_SIZE = 20;

interface HomeProps {
  searchParams: Promise<{ page?: string }>;
}

export function generateMetadata(): Metadata {
  return buildPageMeta({
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    path: "/",
  });
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const db = getDb();
  const { posts } = await listPosts(db, {
    status: "published",
    page,
    pageSize: PAGE_SIZE + 1,
  });

  const hasMore = posts.length > PAGE_SIZE;
  const displayPosts = hasMore ? posts.slice(0, PAGE_SIZE) : posts;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: websiteJsonLd() }}
      />

      <section>
        {displayPosts.length === 0 ? (
          <p className="py-12 text-center text-blog-muted">
            No posts yet.
          </p>
        ) : (
          displayPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))
        )}
      </section>

      <Pagination
        currentPage={page}
        hasMore={hasMore}
        basePath="/"
      />
    </>
  );
}
