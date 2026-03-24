import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPostById, getPostTags } from "@/data/posts";
import { listCategories } from "@/data/categories";
import { listTags } from "@/data/tags";
import { PostForm } from "@/components/admin/post-form";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";

interface EditPostPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { id } = await params;
  const db = getDb();

  const [post, postTags, categories, tags, locale] = await Promise.all([
    getPostById(db, id),
    getPostTags(db, id),
    listCategories(db),
    listTags(db),
    getLocale(),
  ]);

  if (!post) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t(locale, "admin.posts.editPost")}</h2>
        <p className="text-sm text-muted-foreground">{post.title}</p>
      </div>
      <PostForm
        post={{ ...post, tagIds: postTags.map((t) => t.id) }}
        categories={categories}
        tags={tags}
      />
    </div>
  );
}
