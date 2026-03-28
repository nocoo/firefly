import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPostById, getPostTags } from "@/data/posts";
import { listCategories } from "@/data/categories";
import { listTags } from "@/data/entities/tag";
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
    <>
      <PostForm
        post={{ ...post, tagIds: postTags.map((t) => t.id) }}
        categories={categories}
        tags={tags}
      />
    </>
  );
}
