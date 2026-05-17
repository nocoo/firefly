"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { McpToken, McpTokenScope } from "@/models/types";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Select } from "@/components/ui/select";
import { CopyButton, McpSetupGuide } from "./mcp-tokens-setup-guide";
import { McpTokensTable } from "./mcp-tokens-table";

interface McpTokensManagerProps {
  tokens: McpToken[];
  mcpUrl: string;
}

async function callApi(
  url: string,
  init: RequestInit,
  fallbackError: string,
): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? fallbackError);
  }
  return res.json().catch(() => ({}));
}

export function McpTokensManager({ tokens, mcpUrl }: McpTokensManagerProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [clientName, setClientName] = useState("");
  const [createScope, setCreateScope] = useState<McpTokenScope>("full");
  const [newToken, setNewToken] = useState<{
    access_token: string;
    id: string;
  } | null>(null);

  const revokedCount = useMemo(
    () => tokens.filter((t) => t.revoked === 1).length,
    [tokens],
  );

  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  const handleRevoke = async (id: string) => {
    setRevokeTargetId(null);
    setError(null);
    try {
      await callApi(`/api/mcp/tokens/${id}`, { method: "DELETE" }, "Failed to revoke token");
      toast.success("令牌已撤销");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke token");
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteTargetId(null);
    setError(null);
    try {
      await callApi(
        `/api/mcp/tokens/${id}?action=delete`,
        { method: "DELETE" },
        "Failed to delete token",
      );
      toast.success("令牌已删除");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete token");
    }
  };

  const handleBulkDelete = async () => {
    setShowBulkDelete(false);
    setError(null);
    try {
      const data = (await callApi(
        "/api/mcp/tokens",
        { method: "DELETE" },
        "Failed to delete revoked tokens",
      )) as { deleted: number };
      toast.success(`已删除 ${data.deleted} 个已撤销令牌`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete revoked tokens");
    }
  };

  const handleCreate = async () => {
    if (!clientName.trim()) return;
    setError(null);
    setCreating(true);
    try {
      const data = (await callApi(
        "/api/mcp/tokens",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_name: clientName.trim(), scope: createScope }),
        },
        "Failed to create token",
      )) as { access_token: string; id: string };
      setNewToken({ access_token: data.access_token, id: data.id });
      setClientName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create token");
    } finally {
      setCreating(false);
    }
  };

  const handleScopeChange = async (tokenId: string, newScope: McpTokenScope) => {
    try {
      await callApi(
        `/api/mcp/tokens/${tokenId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: newScope }),
        },
        "Failed to update scope",
      );
      toast.success("权限已更新");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update scope");
    }
  };

  return (
    <div className="space-y-8">
      <McpSetupGuide mcpUrl={mcpUrl} />

      <hr className="border-border" />

      {error && (
        <div className="rounded-widget border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {newToken && (
        <div className="rounded-widget border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm">
          <p className="font-medium text-green-700 dark:text-green-400 mb-2">
            令牌创建成功！请立即复制 — 此后将无法再次查看。
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-secondary px-2 py-1 text-xs font-mono break-all">
              {newToken.access_token}
            </code>
            <CopyButton text={newToken.access_token} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">此令牌仅显示一次，请安全保存。</p>
          <button
            onClick={() => setNewToken(null)}
            className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
          >
            关闭
          </button>
        </div>
      )}

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-sm font-medium text-foreground">客户端名称</label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="e.g. Claude Code"
            className="mt-1 w-full rounded-widget border border-border bg-secondary px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </div>
        <div className="w-32 shrink-0">
          <label className="text-sm font-medium text-foreground">权限</label>
          <Select
            value={createScope}
            onChange={(e) => setCreateScope(e.target.value as McpTokenScope)}
            className="mt-1"
          >
            <option value="full">完整</option>
            <option value="author">作者</option>
          </Select>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating || !clientName.trim()}
          className="inline-flex items-center gap-2 rounded-widget bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {creating ? "创建中…" : "创建令牌"}
        </button>
      </div>

      {tokens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <KeyRound className="h-10 w-10 mb-3 opacity-40" strokeWidth={1.5} />
          <p className="text-sm">暂无 MCP 令牌。创建一个以连接 AI Agent。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {revokedCount > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowBulkDelete(true)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {`删除 ${revokedCount} 个已撤销`}
              </button>
            </div>
          )}
          <McpTokensTable
            tokens={tokens}
            onScopeChange={handleScopeChange}
            onRevoke={setRevokeTargetId}
            onDelete={setDeleteTargetId}
          />
        </div>
      )}

      <ConfirmDialog
        open={!!revokeTargetId}
        onOpenChange={(open) => {
          if (!open) setRevokeTargetId(null);
        }}
        title="确定撤销此令牌吗？使用该令牌的 Agent 将立即失去访问权限。"
        description=""
        destructive
        confirmLabel="撤销"
        cancelLabel="取消"
        onConfirm={() => {
          if (revokeTargetId) handleRevoke(revokeTargetId);
        }}
      />

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
        title="确定要永久删除此令牌吗？此操作无法撤销。"
        description=""
        destructive
        confirmLabel="删除"
        cancelLabel="取消"
        onConfirm={() => {
          if (deleteTargetId) handleDelete(deleteTargetId);
        }}
      />

      <ConfirmDialog
        open={showBulkDelete}
        onOpenChange={setShowBulkDelete}
        title={`永久删除 ${revokedCount} 个已撤销令牌？`}
        description=""
        destructive
        confirmLabel="全部删除"
        cancelLabel="取消"
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
