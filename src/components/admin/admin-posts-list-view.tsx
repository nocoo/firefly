"use client";

import Link from "next/link";
import { Pencil, MessageSquare, ExternalLink } from "lucide-react";
import type { PostWithCategory, PostStatus } from "@/models/types";
import { formatDateDisplay } from "@/lib/seo";
import { STATUS_COLORS } from "@/lib/status-colors";
import { DeletePostButton } from "@/components/admin/delete-post-button";
import {
  SortableHeader,
} from "@/components/admin/admin-posts-sortable-header";
import {
  CopyLinkButton,
  getPreviewUrl,
} from "@/components/admin/admin-posts-copy-link";
import { AdminPostsPagination } from "@/components/admin/admin-posts-pagination";

interface PostWithTags extends PostWithCategory {
  tags: { id: string; name: string; slug: string }[];
}

const STATUS_LABELS: Record<PostStatus, string> = {
  draft: "草稿",
  published: "已发布",
  private: "私密",
  archived: "已归档",
};

function PostTableHeader(props: {
  currentSortBy: string;
  currentSortOrder: string;
  currentParams: Record<string, string | undefined>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
}) {
  const { currentSortBy, currentSortOrder, currentParams, allSelected, someSelected, onToggleAll } = props;
  const sortableProps = { currentSortBy, currentSortOrder, currentParams };
  return (
    <thead>
      <tr className="border-b border-border bg-secondary/50">
        <th className="w-10 px-3 py-3">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected && !allSelected;
            }}
            onChange={onToggleAll}
            className="h-4 w-4 rounded border-border text-primary focus:ring-ring cursor-pointer"
            aria-label={allSelected ? "取消全选" : "全选"}
          />
        </th>
        <SortableHeader column="title" label="标题" {...sortableProps} />
        <SortableHeader column="status" label="状态" {...sortableProps} className="hidden sm:table-cell" sortable={false} />
        <SortableHeader column="category" label="分类" {...sortableProps} className="hidden md:table-cell" sortable={false} />
        <SortableHeader column="comment_count" label="评论" {...sortableProps} className="hidden md:table-cell" />
        <SortableHeader column="tags" label="标签" {...sortableProps} className="hidden lg:table-cell" sortable={false} />
        <SortableHeader column="published_at" label="发布时间" {...sortableProps} className="hidden xl:table-cell" />
        <SortableHeader column="created_at" label="创建时间" {...sortableProps} className="hidden xl:table-cell" />
        <th className="px-4 py-3 text-right font-medium text-muted-foreground">操作</th>
      </tr>
    </thead>
  );
}

function PostRowTags({ tags }: { tags: PostWithTags["tags"] }) {
  if (tags.length === 0) return <>—</>;
  return (
    <div className="flex flex-wrap gap-1 max-w-[200px]">
      {tags.slice(0, 3).map((tag) => (
        <span key={tag.id} className="inline-block rounded-md bg-accent px-1.5 py-0.5 text-xs">
          {tag.name}
        </span>
      ))}
      {tags.length > 3 && (
        <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>
      )}
    </div>
  );
}

function PostRowActions({ post }: { post: PostWithTags }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/admin/posts/${post.id}/edit`}
        className="inline-flex items-center gap-1 rounded-widget px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
        编辑
      </Link>
      <CopyLinkButton post={post} />
      <a
        href={getPreviewUrl(post)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-widget p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title="在新标签页打开"
      >
        <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
      </a>
      <DeletePostButton slug={post.slug} title={post.title} />
    </div>
  );
}

function PostRow({
  post,
  isSelected,
  onToggleSelect,
}: {
  post: PostWithTags;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  return (
    <tr
      className={`border-b border-border last:border-0 transition-colors ${
        isSelected ? "bg-primary/5" : "hover:bg-accent/50"
      }`}
    >
      <td className="w-10 px-3 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(post.id)}
          className="h-4 w-4 rounded border-border text-primary focus:ring-ring cursor-pointer"
        />
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/admin/posts/${post.id}/edit`}
          className="font-medium text-foreground hover:text-primary transition-colors"
        >
          {post.title}
        </Link>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[post.status as PostStatus] ?? ""}`}>
          {STATUS_LABELS[post.status as PostStatus] ?? post.status}
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
        {post.category_name ?? "—"}
      </td>
      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} />
          {post.comment_count ?? 0}
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
        <PostRowTags tags={post.tags} />
      </td>
      <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">
        {post.published_at ? formatDateDisplay(post.published_at) : "—"}
      </td>
      <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">
        {formatDateDisplay(post.created_at)}
      </td>
      <td className="px-4 py-3 text-right">
        <PostRowActions post={post} />
      </td>
    </tr>
  );
}

export function AdminPostsListView({
  posts,
  totalPages,
  currentPage,
  currentParams,
  currentSortBy,
  currentSortOrder,
  selectedIds,
  onToggleSelect,
  onToggleAll,
}: {
  posts: PostWithTags[];
  total: number;
  totalPages: number;
  currentPage: number;
  currentParams: Record<string, string | undefined>;
  currentSortBy: string;
  currentSortOrder: string;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: (allIds: string[]) => void;
}) {
  const allIds = posts.map((p) => p.id);
  const allSelected = posts.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = posts.length > 0 && allIds.some((id) => selectedIds.has(id));

  return (
    <>
      <div className="overflow-x-auto rounded-widget border border-border bg-secondary">
        <table className="w-full text-sm">
          <PostTableHeader
            currentSortBy={currentSortBy}
            currentSortOrder={currentSortOrder}
            currentParams={currentParams}
            allSelected={allSelected}
            someSelected={someSelected}
            onToggleAll={() => onToggleAll(allIds)}
          />
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  未找到文章
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  isSelected={selectedIds.has(post.id)}
                  onToggleSelect={onToggleSelect}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <AdminPostsPagination
          totalPages={totalPages}
          currentPage={currentPage}
          currentParams={currentParams}
        />
      )}
    </>
  );
}
