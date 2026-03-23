import { BlogSidebar } from "@/components/blog/blog-sidebar";
import { BlogFooter } from "@/components/blog/blog-footer";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="blog-shell">
      <div className="blog-max-width">
        <BlogSidebar />
        <main className="blog-main">
          {children}
          <BlogFooter />
        </main>
      </div>
    </div>
  );
}
