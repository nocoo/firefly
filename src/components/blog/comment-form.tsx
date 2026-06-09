"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CommentFormProps {
  postId: string;
  /** When true the form is mounted (admin is signed in). */
  enabled: boolean;
}

/**
 * Inline comment form below the comment list. Admin-only at this stage —
 * shown on `enabled=true`, otherwise we render a small placeholder so the
 * comment section never collapses into nothing on a clean post. Submission
 * goes through `/api/comments` which itself checks the session.
 */
export function CommentForm({ postId, enabled }: CommentFormProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!enabled) {
    return (
      <p className="mt-6 text-sm text-blog-muted">
        留言功能仅站长开启 — 通过邮件或社交链接联系。
      </p>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, content }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "发表评论失败");
        return;
      }
      toast.success("评论已发表");
      setContent("");
      // Refresh server component to pick up the new comment thread.
      router.refresh();
    } catch {
      toast.error("发表评论失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3">
      <label htmlFor="comment-content" className="sr-only">
        评论内容
      </label>
      <textarea
        id="comment-content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        maxLength={4000}
        placeholder="写下你的评论..."
        className="w-full rounded-widget border border-blog-separator bg-blog-bg px-3 py-2 text-sm text-blog-text placeholder:text-blog-muted focus:outline-none focus:border-blog-accent"
        required
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-blog-muted">
          {content.length} / 4000
        </span>
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="inline-flex items-center gap-2 rounded-widget bg-blog-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
          )}
          {submitting ? "发表中..." : "发表评论"}
        </button>
      </div>
    </form>
  );
}
