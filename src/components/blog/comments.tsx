import type { CommentTree } from "@/models/types";
import { formatDateDisplay } from "@/lib/seo";
import { t, type Locale } from "@/i18n/translations";

interface CommentItemProps {
  comment: CommentTree;
  depth?: number;
}

function CommentItem({ comment, depth = 0 }: CommentItemProps) {
  const maxNestingDepth = 3;
  const effectiveDepth = Math.min(depth, maxNestingDepth);

  return (
    <div
      className={effectiveDepth > 0 ? "ml-6 border-l-2 border-blog-separator pl-4" : ""}
    >
      <div className="py-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-blog-muted">
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
          <time dateTime={new Date(comment.created_at * 1000).toISOString()}>
            {formatDateDisplay(comment.created_at)}
          </time>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CommentsProps {
  comments: CommentTree[];
  locale: Locale;
}

export function Comments({ comments, locale }: CommentsProps) {
  if (comments.length === 0) return null;

  return (
    <section className="mt-12 border-t border-blog-separator pt-6">
      <h2 className="mb-4 text-lg font-semibold text-blog-text">
        {t(locale, "blog.comments.title")}
      </h2>
      <div className="divide-y divide-blog-separator">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>
    </section>
  );
}
