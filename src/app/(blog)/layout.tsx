import { getDb } from "@/lib/db";
import { listCategories } from "@/data/entities/category";
import { listTags } from "@/data/entities/tag";
import { listMonthlyArchives } from "@/data/entities/post";
import { getSiteSettings } from "@/data/settings";
import { isAdminSession } from "@/lib/auth";
import { BlogLayoutClient } from "@/components/blog/blog-layout-client";
import { BlogFooter } from "@/components/blog/blog-footer";
import { JournalThemeColor } from "@/components/blog/journal-theme-color";
import type { Metadata, Viewport } from "next";
import "./journal.css";

export const metadata: Metadata = { icons: { icon: "/journal-icon.svg" } };
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0f0e9" },
    { media: "(prefers-color-scheme: dark)", color: "#1e2824" },
  ],
};

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
    <div className="blog-shell journal-theme">
      <JournalThemeColor />
      <a
        href="#main"
        className="journal-skip-link"
      >
        跳到正文
      </a>
      <BlogLayoutClient
        categories={activeCategories}
        tags={activeTags}
        archives={archives}
        siteName={settings.siteName}
        socialLinks={settings.socialLinks}
        isAdmin={isAdmin}
      >
        {children}
      </BlogLayoutClient>
      <BlogFooter siteName={settings.siteName} />
    </div>
  );
}
