import { forwardRef } from "react";
import Link from "next/link";
import type { Category, Tag } from "@/models/types";
import type { MonthlyArchive } from "@/data/entities/post";
import { SearchInput } from "./search-input";
import type { SocialLink } from "@/data/settings";
import { JournalSocialLinks } from "./social-link";
import { ArchiveNavigation } from "./archive-navigation";

interface BlogSidebarProps {
  categories: Category[];
  tags: Tag[];
  archives: MonthlyArchive[];
  socialLinks: SocialLink[];
  drawerOpen?: boolean;
  isMobile?: boolean;
}

export const BlogSidebar = forwardRef<HTMLElement, BlogSidebarProps>(function BlogSidebar({
  categories, tags, archives, socialLinks,
  drawerOpen = false, isMobile = false,
}, ref) {
  // On mobile when closed, hide from a11y tree + disable keyboard focus
  const inert = isMobile && !drawerOpen;
  // Modal semantics only meaningful while the drawer is actually displayed
  const modalProps = isMobile && drawerOpen
    ? { role: "dialog" as const, "aria-modal": true as const }
    : {};

  return (
    <aside
      ref={ref}
      id="blog-sidebar"
      className={`blog-sidebar blog-sidebar-desktop${drawerOpen ? " blog-sidebar-open" : ""}`}
      aria-label="Site navigation"
      aria-hidden={inert ? true : undefined}
      inert={inert || undefined}
      tabIndex={-1}
      {...modalProps}
    >
      <JournalSocialLinks links={socialLinks} />
      <div className="blog-sidebar-bottom">
        <p className="journal-eyebrow" lang="en"><span aria-hidden="true" /> THE COLLECTION</p>
        <SearchInput />

        {categories.length > 0 && (
          <nav className="blog-sidebar-section">
            <h3 className="journal-eyebrow">
              <span aria-hidden="true" />
              分类
            </h3>
            <ul className="blog-sidebar-list">
              {categories.map((cat) => (
                <li key={cat.id}>
                  <Link href={`/category/${cat.slug}`} prefetch={false}>
                    <span>{cat.name}</span>
                    <span className="blog-sidebar-count">{cat.post_count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {tags.length > 0 && (
          <nav className="blog-sidebar-section">
            <h3 className="journal-eyebrow">
              <span aria-hidden="true" />
              标签
            </h3>
            <div className="blog-tag-cloud">
              {(() => {
                const counts = tags.map((tg) => tg.post_count ?? 0);
                const maxCount = Math.max(...counts, 1);
                const minSize = 0.8125;
                const maxSize = 1.375;
                return tags.map((tag) => {
                  const weight = (tag.post_count ?? 0) / maxCount;
                  const size = minSize + weight * (maxSize - minSize);
                  return (
                    <Link
                      key={tag.id}
                      href={`/tag/${tag.slug}`}
                      prefetch={false}
                      style={{ fontSize: `${size}em` }}
                    >
                      {tag.name}
                    </Link>
                  );
                });
              })()}
            </div>
          </nav>
        )}

        <ArchiveNavigation archives={archives} />
      </div>
    </aside>
  );
});
