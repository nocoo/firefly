import { getDb } from "@/lib/db";
import { listCategories } from "@/data/entities/category";
import { listTags } from "@/data/entities/tag";
import { listMonthlyArchives } from "@/data/entities/post";
import { getSiteSettings } from "@/data/settings";
import { isAdminSession } from "@/lib/auth";
import { BlogGlobalBar } from "@/components/blog/blog-global-bar";
import { BlogLayoutClient } from "@/components/blog/blog-layout-client";
import { BlogFooter } from "@/components/blog/blog-footer";

export default async function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const db = getDb();
  const [categories, tags, archives, settings, isAdmin] = await Promise.all([
    listCategories(db),
    listTags(db),
    listMonthlyArchives(db),
    getSiteSettings(db),
    isAdminSession(),
  ]);

  // Only show categories/tags that have published posts
  const activeCategories = categories.filter((c) => c.post_count > 0);
  const activeTags = tags.filter((t) => t.post_count > 0);

  return (
    <div className="blog-shell">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-blog-bg focus:px-4 focus:py-2 focus:text-blog-text"
      >
        Skip to content
      </a>
      <BlogGlobalBar isAdmin={isAdmin} />
      <div className="page-wrapper">
        <div className="blog-max-width">
          <BlogLayoutClient
            categories={activeCategories}
            tags={activeTags}
            archives={archives}
            siteName={settings.siteName}
            siteTagline={settings.siteTagline}
            socialLinks={settings.socialLinks}
          >
            {children}
          </BlogLayoutClient>
        </div>
        <BlogFooter siteName={settings.siteName} />
      </div>
    </div>
  );
}
