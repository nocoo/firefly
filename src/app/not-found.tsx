import Link from "next/link";
import { getDb } from "@/lib/db";
import { getSiteSettings } from "@/data/settings";
import { listPosts } from "@/data/entities/post";
import { BlogFooter } from "@/components/blog/blog-footer";
import { postPath } from "@/lib/seo";

export default async function NotFound() {
  const db = getDb();
  const [settings, listing] = await Promise.all([
    getSiteSettings(db),
    listPosts(db, { status: "published", page: 1, pageSize: 5 }).catch(() => ({
      posts: [],
      total: 0,
    })),
  ]);
  const recent = listing.posts;

  return (
    <div className="blog-shell">
      <div className="page-wrapper">
        <main id="main" className="blog-main">
          <div className="blog-main-inner blog-main-inner-post">
            <div className="py-16 text-center">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-blog-muted">
                404
              </p>
              <h1 className="mt-6 text-3xl font-bold text-blog-text md:text-4xl">
                页面不存在
              </h1>
              <p className="mt-3 text-blog-muted">
                您访问的页面已被移除或从未存在。
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 font-mono text-sm">
                <Link
                  href="/"
                  className="text-blog-text underline decoration-blog-accent decoration-2 underline-offset-4 hover:decoration-blog-text"
                >
                  返回首页
                </Link>
                <span aria-hidden="true" className="text-blog-muted">
                  ·
                </span>
                <Link
                  href="/search"
                  className="text-blog-muted hover:text-blog-text"
                >
                  搜索
                </Link>
              </div>
            </div>

            {recent.length > 0 && (
              <section aria-labelledby="recent-heading" className="pb-12">
                <div className="cross-divider" />
                <h2 id="recent-heading" className="blog-sidebar-heading">
                  最近发布
                </h2>
                <ul className="blog-sidebar-list">
                  {recent.map((post) => (
                    <li key={post.id}>
                      <Link
                        href={postPath(post.slug, post.published_at)}
                        prefetch={false}
                      >
                        <span>{post.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </main>
      </div>
      <BlogFooter siteName={settings.siteName} />
    </div>
  );
}
