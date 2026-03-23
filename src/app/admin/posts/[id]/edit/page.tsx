import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPostById, getPostTags } from "@/data/posts";
import { listCategories } from "@/data/categories";
import { listTags } from "@/data/tags";
import { PostForm } from "@/components/admin/post-form";

interface EditPostPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { id } = await params;
  const db = getDb();

  const [post, postTags, categories, tags] = await Promise.all([
    getPostById(db, id),
    getPostTags(db, id),
    listCategories(db),
    listTags(db),
  ]);

  if (!post) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Edit Post</h2>
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
