import { getDb } from "@/lib/db";
import { listCategories } from "@/data/categories";
import { listTags } from "@/data/tags";
import { listMonthlyArchives } from "@/data/posts";
import { BlogSidebar } from "@/components/blog/blog-sidebar";
import { BlogFooter } from "@/components/blog/blog-footer";

export default async function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const db = getDb();
  const [categories, tags, archives] = await Promise.all([
    listCategories(db),
    listTags(db),
    listMonthlyArchives(db),
  ]);

  // Only show categories/tags that have published posts
  const activeCategories = categories.filter((c) => c.post_count > 0);
  const activeTags = tags.filter((t) => t.post_count > 0);

  return (
    <div className="blog-shell">
      <div className="blog-max-width">
        <BlogSidebar
          categories={activeCategories}
          tags={activeTags}
          archives={archives}
        />
        <main className="blog-main">
          {children}
          <BlogFooter />
        </main>
      </div>
    </div>
  );
}
