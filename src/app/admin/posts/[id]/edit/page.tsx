import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPostById, getPostTags } from "@/data/entities/post";
import { listCategories } from "@/data/entities/category";
import { listTags } from "@/data/entities/tag";
import { listHumans, getDefaultHumanIdUncached } from "@/data/entities/human";
import { listAiAgents } from "@/data/entities/ai-agent";
import {
  listCommentsByPost,
  buildCommentTree,
} from "@/data/entities/comment";
import { PostForm } from "@/components/admin/post-form";
import { Comments } from "@/components/blog/comments";

interface EditPostPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: EditPostPageProps): Promise<Metadata> {
  const { id } = await params;
  const db = getDb();
  const post = await getPostById(db, id);
  return {
    title: post?.title ? `编辑：${post.title}` : "编辑文章",
  };
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { id } = await params;
  const db = getDb();

  const [post, postTags, categories, tags, comments, humans, agents, defaultHumanId] =
    await Promise.all([
      getPostById(db, id),
      getPostTags(db, id),
      listCategories(db),
      listTags(db),
      listCommentsByPost(db, id),
      listHumans(db),
      listAiAgents(db),
      getDefaultHumanIdUncached(db),
    ]);

  if (!post) notFound();

  const commentTree = buildCommentTree(comments);

  return (
    <>
      <PostForm
        post={{ ...post, tagIds: postTags.map((t) => t.id) }}
        categories={categories}
        tags={tags}
        humans={humans}
        agents={agents}
        defaultHumanId={defaultHumanId}
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
