import { getDb } from "@/lib/db";
import { listCategories } from "@/data/categories";
import { listTags } from "@/data/tags";
import { PostForm } from "@/components/admin/post-form";

export default async function NewPostPage() {
  const db = getDb();
  const [categories, tags] = await Promise.all([
    listCategories(db),
    listTags(db),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">New Post</h2>
        <p className="text-sm text-muted-foreground">
          Create a new blog post
        </p>
      </div>
      <PostForm categories={categories} tags={tags} />
    </div>
  );
}
