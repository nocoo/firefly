import type { CommentTree } from "@/models/types";
import { formatDateDisplay } from "@/lib/seo";
import { DeleteCommentButton } from "@/components/blog/delete-comment-button";

interface CommentItemProps {
  comment: CommentTree;
  depth?: number;
  isAdmin?: boolean;
}

function CommentItem({ comment, depth = 0, isAdmin }: CommentItemProps) {
  const maxNestingDepth = 3;
  const effectiveDepth = Math.min(depth, maxNestingDepth);
  const anchorId = `c-${comment.id}`;
  const isoDate = new Date(comment.created_at * 1000).toISOString();

  return (
    <div
      id={anchorId}
      className={
        effectiveDepth > 0 ? "ml-6 border-l-2 border-blog-separator pl-4" : ""
      }
    >
      <div className="py-4 scroll-mt-12">
        <div className="mb-2 flex items-center gap-2 text-sm text-blog-text">
          <span className="font-medium text-blog-text">
            {comment.author_url ? (
              <a
                href={comment.author_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="transition-colors hover:text-blog-accent"
              >
                {comment.author_name}
              </a>
            ) : (
              comment.author_name
            )}
          </span>
          <span>&middot;</span>
          <a
            href={`#${anchorId}`}
            className="text-blog-muted hover:text-blog-accent transition-colors"
            aria-label="评论链接"
          >
            <time dateTime={isoDate}>
              {formatDateDisplay(comment.created_at)}
            </time>
          </a>
          {isAdmin && (
            <DeleteCommentButton
              commentId={comment.id}
              authorName={comment.author_name}
              confirmMessage="确认删除 {name} 的评论？"
              deleteLabel="删除"
              failedMessage="删除评论失败"
            />
          )}
        </div>
        <div className="text-sm leading-relaxed text-blog-text">
          {comment.content}
        </div>
      </div>

      {comment.children.length > 0 && (
        <div>
          {comment.children.map((child) => (
            <CommentItem
              key={child.id}
              comment={child}
              depth={depth + 1}
              {...(isAdmin ? { isAdmin } : {})}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CommentsProps {
  comments: CommentTree[];
  isAdmin?: boolean;
}

export function Comments({ comments, isAdmin }: CommentsProps) {
  if (comments.length === 0) return null;

  return (
    <section className="mt-12 border-t border-blog-separator pt-6">
      <h2 className="mb-4 text-lg font-semibold text-blog-text">
        评论
      </h2>
      <div className="divide-y divide-blog-separator">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} {...(isAdmin ? { isAdmin } : {})} />
        ))}
      </div>
    </section>
  );
}
