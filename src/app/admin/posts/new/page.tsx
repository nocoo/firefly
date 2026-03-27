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

  return <PostForm categories={categories} tags={tags} />;
}
