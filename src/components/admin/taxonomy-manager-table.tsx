"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink, Pencil, Trash2 } from "lucide-react";

export interface TaxonomyItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  post_count: number;
  /** Total posts (all statuses). Only present for categories. */
  total_posts?: number;
  /** Published posts. Only present for categories. */
  published_posts?: number;
  /** Draft posts. Only present for categories. */
  draft_posts?: number;
}

function ReorderCell({
  index,
  total,
  onMove,
}: {
  index: number;
  total: number;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <td className="w-16 pl-2 pr-0 py-3">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label="Move up"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronUp className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          aria-label="Move down"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </td>
  );
}

function PostCountCell({
  item,
  hasStats,
}: {
  item: TaxonomyItem;
  hasStats: boolean;
}) {
  if (hasStats) {
    return (
      <td className="px-4 py-3 text-center text-muted-foreground">
        <span title={`已发布: ${item.published_posts ?? 0}, 草稿: ${item.draft_posts ?? 0}`}>
          {item.total_posts ?? 0}
          <span className="text-xs text-muted-foreground/60 ml-1">
            ({item.published_posts ?? 0}/{item.draft_posts ?? 0})
          </span>
        </span>
      </td>
    );
  }
  return (
    <td className="px-4 py-3 text-center text-muted-foreground">
      {item.post_count}
    </td>
  );
}

function ActionsCell({
  item,
  type,
  onEdit,
  onDelete,
}: {
  item: TaxonomyItem;
  type: "category" | "tag";
  onEdit: () => void;
  onDelete: () => void;
}) {
  const totalCount = item.total_posts ?? item.post_count;
  return (
    <td className="px-4 py-3 text-right">
      <div className="flex items-center justify-end gap-1">
        {totalCount > 0 && (
          <Link
            href={`/admin/posts?${type === "category" ? "category" : "tag"}=${item.id}`}
            className="inline-flex items-center gap-1 rounded-widget px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
            查看全部
          </Link>
        )}
        <button type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-widget px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
          编辑
        </button>
        <button type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 rounded-widget px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          删除
        </button>
      </div>
    </td>
  );
}

export function TaxonomyTable({
  type,
  items,
  onMove,
  onEdit,
  onDelete,
}: {
  type: "category" | "tag";
  items: TaxonomyItem[];
  onMove: (index: number, direction: -1 | 1) => void;
  onEdit: (item: TaxonomyItem) => void;
  onDelete: (item: TaxonomyItem) => void;
}) {
  const sortable = type === "category";
  const colCount = sortable ? 6 : 5;
  const hasStats = sortable && items.some((i) => i.total_posts !== undefined);
  const emptyMessage = type === "category" ? "暂无分类" : "暂无标签";

  return (
    <div className="overflow-x-auto rounded-widget border border-border bg-secondary">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            {sortable && <th className="w-16 pl-2 pr-0 py-3" />}
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">名称</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">别名</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">描述</th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground">文章数</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">操作</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="px-4 py-8 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <tr
                key={item.id}
                className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
              >
                {sortable && (
                  <ReorderCell
                    index={index}
                    total={items.length}
                    onMove={(dir) => onMove(index, dir)}
                  />
                )}
                <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                  {item.slug}
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                  {item.description ?? "—"}
                </td>
                <PostCountCell item={item} hasStats={hasStats} />
                <ActionsCell
                  item={item}
                  type={type}
                  onEdit={() => onEdit(item)}
                  onDelete={() => onDelete(item)}
                />
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
