import { getDb } from "@/lib/db";
import { listCategories } from "@/data/categories";
import { listTags } from "@/data/tags";
import { listMonthlyArchives } from "@/data/posts";
import { BlogSidebar } from "@/components/blog/blog-sidebar";
import { BlogFooter } from "@/components/blog/blog-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";
import { getLocale } from "@/i18n/server";

export default async function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const db = getDb();
  const [categories, tags, archives, locale] = await Promise.all([
    listCategories(db),
    listTags(db),
    listMonthlyArchives(db),
    getLocale(),
  ]);

  // Only show categories/tags that have published posts
  const activeCategories = categories.filter((c) => c.post_count > 0);
  const activeTags = tags.filter((t) => t.post_count > 0);

  return (
    <div className="blog-shell">
      <div className="blog-max-width">
        <BlogSidebar
          locale={locale}
          categories={activeCategories}
          tags={activeTags}
          archives={archives}
        />
        <main className="blog-main">
          <div className="blog-theme-toggle">
            <LocaleToggle />
            <ThemeToggle />
          </div>
          {children}
          <BlogFooter locale={locale} />
        </main>
      </div>
    </div>
  );
}
