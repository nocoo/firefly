import type { CommentTree } from "@/models/types";
import { formatDateDisplay } from "@/lib/seo";

interface CommentItemProps {
  comment: CommentTree;
  depth?: number;
}

function CommentItem({ comment, depth = 0 }: CommentItemProps) {
  const maxNestingDepth = 3;
  const effectiveDepth = Math.min(depth, maxNestingDepth);

  return (
    <div
      className={effectiveDepth > 0 ? "ml-6 border-l-2 border-gray-200 dark:border-gray-800 pl-4" : ""}
    >
      <div className="py-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {comment.author_url ? (
              <a
                href={comment.author_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {comment.author_name}
              </a>
            ) : (
              comment.author_name
            )}
          </span>
          <span>·</span>
          <time dateTime={new Date(comment.created_at * 1000).toISOString()}>
            {formatDateDisplay(comment.created_at)}
          </time>
        </div>
        <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CommentsProps {
  comments: CommentTree[];
}

export function Comments({ comments }: CommentsProps) {
  if (comments.length === 0) return null;

  return (
    <section className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Comments
      </h2>
      <div className="divide-y divide-gray-100 dark:divide-gray-900">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>
    </section>
  );
}
