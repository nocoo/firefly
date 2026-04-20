"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, Copy, Check, Terminal, Trash2, Shield, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { McpToken, McpTokenScope } from "@/models/types";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Select } from "@/components/ui/select";

interface McpTokensManagerProps {
  tokens: McpToken[];
  mcpUrl: string;
}

// ---------------------------------------------------------------------------
// Copy button (reusable)
// ---------------------------------------------------------------------------

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className={`shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors ${className ?? ""}`}
      title="Copy"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Code block with copy button
// ---------------------------------------------------------------------------

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="group relative rounded-[var(--radius-widget)] bg-secondary border border-border">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <span className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
          {lang ?? "config"}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-3 text-xs font-mono leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup guide section
// ---------------------------------------------------------------------------

function SetupGuide({ mcpUrl }: { mcpUrl: string }) {
  const [activeTab, setActiveTab] = useState<"claude" | "cursor" | "cli">(
    "claude",
  );

  const placeholder = "YOUR_TOKEN";

  const configs = {
    claude: `{
  "mcpServers": {
    "firefly": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer ${placeholder}"
      }
    }
  }
}`,
    cursor: `{
  "mcpServers": {
    "firefly": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer ${placeholder}"
      }
    }
  }
}`,
    cli: `curl -X POST ${mcpUrl} \\
  -H "Authorization: Bearer ${placeholder}" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
  };

  const tabs = [
    { key: "claude" as const, label: "Claude Code" },
    { key: "cursor" as const, label: "Cursor" },
    { key: "cli" as const, label: "cURL" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-secondary p-2">
          <Terminal className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            配置指南
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            通过 Model Context Protocol 将 AI Agent 连接到博客。在下方创建令牌，然后将配置粘贴到客户端。
          </p>
        </div>
      </div>

      {/* Endpoint URL */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          MCP 端点
        </label>
        <div className="flex items-center gap-2 rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2">
          <code className="flex-1 text-xs font-mono text-foreground break-all">
            {mcpUrl}
          </code>
          <CopyButton text={mcpUrl} />
        </div>
      </div>

      {/* Steps */}
      <ol className="space-y-1 text-xs text-muted-foreground leading-relaxed list-decimal list-inside">
        <li>在下方创建令牌 — 名称与客户端对应（如 &quot;Claude Code&quot;）。</li>
        <li>复制令牌（仅显示一次），替换配置中的 YOUR_TOKEN。</li>
        <li>将配置粘贴到客户端的 MCP 设置文件中，然后重启客户端。</li>
      </ol>

      {/* Config tabs */}
      <div className="space-y-2">
        <div className="flex gap-1 rounded-lg bg-secondary/50 p-0.5 w-fit">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === key
                  ? "bg-secondary text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <CodeBlock
          code={configs[activeTab]}
          lang={activeTab === "cli" ? "bash" : "json"}
        />
      </div>

      {/* Available tools summary */}
      <p className="text-xs text-muted-foreground">
        16 个工具可用 — 文章（增删改查 + AI 摘要）、标签（增删改查）、分类（增删改查）。
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

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

  const formatDate = (epoch: number | null) => {
    if (!epoch) return "—";
    return new Date(epoch * 1000).toLocaleString();
  };

  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  const handleRevoke = async (id: string) => {
    setRevokeTargetId(null);
    setError(null);
    try {
      const res = await fetch(`/api/mcp/tokens/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to revoke token");
      }
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
      const res = await fetch(`/api/mcp/tokens/${id}?action=delete`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete token");
      }
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
      const res = await fetch("/api/mcp/tokens", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete revoked tokens");
      }
      const data = await res.json();
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
      const res = await fetch("/api/mcp/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: clientName.trim(), scope: createScope }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create token");
      }
      const data = await res.json();
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
      const res = await fetch(`/api/mcp/tokens/${tokenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: newScope }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update scope");
      }
      toast.success("权限已更新");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update scope");
    }
  };

  return (
    <div className="space-y-8">
      {/* Setup guide */}
      <SetupGuide mcpUrl={mcpUrl} />

      <hr className="border-border" />

      {/* Error banner */}
      {error && (
        <div className="rounded-[var(--radius-widget)] border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* New token banner */}
      {newToken && (
        <div className="rounded-[var(--radius-widget)] border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm">
          <p className="font-medium text-green-700 dark:text-green-400 mb-2">
            令牌创建成功！请立即复制 — 此后将无法再次查看。
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-secondary px-2 py-1 text-xs font-mono break-all">
              {newToken.access_token}
            </code>
            <CopyButton text={newToken.access_token} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            此令牌仅显示一次，请安全保存。
          </p>
          <button
            onClick={() => setNewToken(null)}
            className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
          >
            关闭
          </button>
        </div>
      )}

      {/* Create token form */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-sm font-medium text-foreground">
            客户端名称
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="e.g. Claude Code"
            className="mt-1 w-full rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </div>
        <div className="w-32 shrink-0">
          <label className="text-sm font-medium text-foreground">
            权限
          </label>
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
          className="inline-flex items-center gap-2 rounded-[var(--radius-widget)] bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {creating ? "创建中…" : "创建令牌"}
        </button>
      </div>

      {/* Token table */}
      {tokens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <KeyRound
            className="h-10 w-10 mb-3 opacity-40"
            strokeWidth={1.5}
          />
          <p className="text-sm">暂无 MCP 令牌。创建一个以连接 AI Agent。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Bulk delete button */}
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
          <div className="overflow-x-auto rounded-[var(--radius-widget)] border border-border bg-secondary">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    客户端
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                    令牌
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    权限
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                    最后使用
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                    创建时间
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    状态
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  </th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => {
                  const isRevoked = token.revoked === 1;
                  const isExpired =
                    token.expires_at < Math.floor(Date.now() / 1000);
                  const status = isRevoked
                    ? "已撤销"
                    : isExpired
                      ? "已过期"
                      : "有效";
                  const statusClass =
                    isRevoked || isExpired
                      ? "text-muted-foreground"
                      : "text-green-600 dark:text-green-400";

                  return (
                    <tr
                      key={token.id}
                      className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">
                        {token.client_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono">
                          {token.access_token_preview}…
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        {isRevoked ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            {token.scope === "author" ? (
                              <ShieldCheck className="h-3.5 w-3.5" />
                            ) : (
                              <Shield className="h-3.5 w-3.5" />
                            )}
                            {token.scope === "author" ? "作者" : "完整"}
                          </span>
                        ) : (
                          <Select
                            value={token.scope}
                            onChange={(e) => handleScopeChange(token.id, e.target.value as McpTokenScope)}
                            className="h-7 py-1 pl-2 pr-8 text-xs"
                          >
                            <option value="full">完整</option>
                            <option value="author">作者</option>
                          </Select>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {formatDate(token.last_used_at)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                        {formatDate(token.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${statusClass}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isRevoked ? (
                          <button
                            onClick={() => setDeleteTargetId(token.id)}
                            className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                          >
                            删除
                          </button>
                        ) : (
                          <button
                            onClick={() => setRevokeTargetId(token.id)}
                            className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                          >
                            撤销
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revoke confirmation dialog */}
      <ConfirmDialog
        open={!!revokeTargetId}
        onOpenChange={(open) => { if (!open) setRevokeTargetId(null); }}
        title="确定撤销此令牌吗？使用该令牌的 Agent 将立即失去访问权限。"
        description=""
        destructive
        confirmLabel="撤销"
        cancelLabel="取消"
        onConfirm={() => { if (revokeTargetId) handleRevoke(revokeTargetId); }}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
        title="确定要永久删除此令牌吗？此操作无法撤销。"
        description=""
        destructive
        confirmLabel="删除"
        cancelLabel="取消"
        onConfirm={() => { if (deleteTargetId) handleDelete(deleteTargetId); }}
      />

      {/* Bulk delete confirmation dialog */}
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
