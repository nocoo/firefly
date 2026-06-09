import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPostById, getPostTags } from "@/data/entities/post";
import { listCategories } from "@/data/entities/category";
import { listTags } from "@/data/entities/tag";
import {
  listCommentsByPost,
  buildCommentTree,
} from "@/data/entities/comment";
import { PostForm } from "@/components/admin/post-form";
import { Comments } from "@/components/blog/comments";

interface EditPostPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { id } = await params;
  const db = getDb();

  const [post, postTags, categories, tags, comments] =
    await Promise.all([
      getPostById(db, id),
      getPostTags(db, id),
      listCategories(db),
      listTags(db),
      listCommentsByPost(db, id),
    ]);

  if (!post) notFound();

  const commentTree = buildCommentTree(comments);

  return (
    <>
      <PostForm
        post={{ ...post, tagIds: postTags.map((t) => t.id) }}
        categories={categories}
        tags={tags}
      />
      {commentTree.length > 0 && (
        <section className="mt-8 rounded-widget border border-border p-6">
          <h2 className="mb-4 text-lg font-semibold">
            评论 ({comments.length})
          </h2>
          <Comments comments={commentTree} postId={id} isAdmin />
        </section>
      )}
    </>
  );
}
