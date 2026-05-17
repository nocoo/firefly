"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";

/**
 * All three confirm dialogs (revoke / delete / bulk-delete) wrapped together.
 * Each opens when its target id / boolean is truthy.
 */
export function McpTokensConfirmDialogs({
  revokeTargetId,
  deleteTargetId,
  showBulkDelete,
  revokedCount,
  onRevokeCancel,
  onDeleteCancel,
  onBulkDeleteOpenChange,
  onRevokeConfirm,
  onDeleteConfirm,
  onBulkDeleteConfirm,
}: {
  revokeTargetId: string | null;
  deleteTargetId: string | null;
  showBulkDelete: boolean;
  revokedCount: number;
  onRevokeCancel: () => void;
  onDeleteCancel: () => void;
  onBulkDeleteOpenChange: (open: boolean) => void;
  onRevokeConfirm: () => void;
  onDeleteConfirm: () => void;
  onBulkDeleteConfirm: () => void;
}) {
  return (
    <>
      <ConfirmDialog
        open={!!revokeTargetId}
        onOpenChange={(open) => {
          if (!open) onRevokeCancel();
        }}
        title="确定撤销此令牌吗？使用该令牌的 Agent 将立即失去访问权限。"
        description=""
        destructive
        confirmLabel="撤销"
        cancelLabel="取消"
        onConfirm={onRevokeConfirm}
      />

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => {
          if (!open) onDeleteCancel();
        }}
        title="确定要永久删除此令牌吗？此操作无法撤销。"
        description=""
        destructive
        confirmLabel="删除"
        cancelLabel="取消"
        onConfirm={onDeleteConfirm}
      />

      <ConfirmDialog
        open={showBulkDelete}
        onOpenChange={onBulkDeleteOpenChange}
        title={`永久删除 ${revokedCount} 个已撤销令牌？`}
        description=""
        destructive
        confirmLabel="全部删除"
        cancelLabel="取消"
        onConfirm={onBulkDeleteConfirm}
      />
    </>
  );
}
