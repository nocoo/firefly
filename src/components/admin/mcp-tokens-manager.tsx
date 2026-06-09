"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { McpToken, McpTokenScope } from "@/models/types";
import { EmptyState } from "@/components/ui/empty-state";
import { McpSetupGuide } from "./mcp-tokens-setup-guide";
import { McpTokensTable } from "./mcp-tokens-table";
import { McpTokenCreateForm } from "./mcp-tokens-create-form";
import { McpNewTokenBanner } from "./mcp-tokens-new-banner";
import { McpTokensConfirmDialogs } from "./mcp-tokens-confirm-dialogs";

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
        <McpNewTokenBanner
          accessToken={newToken.access_token}
          onClose={() => setNewToken(null)}
        />
      )}

      <McpTokenCreateForm
        clientName={clientName}
        scope={createScope}
        creating={creating}
        onClientNameChange={setClientName}
        onScopeChange={setCreateScope}
        onCreate={handleCreate}
      />

      {tokens.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          message="暂无 MCP 令牌。创建一个以连接 AI Agent。"
          variant="admin"
        />
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

      <McpTokensConfirmDialogs
        revokeTargetId={revokeTargetId}
        deleteTargetId={deleteTargetId}
        showBulkDelete={showBulkDelete}
        revokedCount={revokedCount}
        onRevokeCancel={() => setRevokeTargetId(null)}
        onDeleteCancel={() => setDeleteTargetId(null)}
        onBulkDeleteOpenChange={setShowBulkDelete}
        onRevokeConfirm={() => {
          if (revokeTargetId) handleRevoke(revokeTargetId);
        }}
        onDeleteConfirm={() => {
          if (deleteTargetId) handleDelete(deleteTargetId);
        }}
        onBulkDeleteConfirm={handleBulkDelete}
      />
    </div>
  );
}
