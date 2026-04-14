"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, Copy, Check, Terminal, Trash2, Shield, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { McpToken, McpTokenScope } from "@/models/types";
import { useLocale } from "@/i18n/context";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

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

function SetupGuide({
  mcpUrl,
  t,
}: {
  mcpUrl: string;
  t: (key: string) => string;
}) {
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
            {t("admin.mcpTokens.guideTitle")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            {t("admin.mcpTokens.guideDesc")}
          </p>
        </div>
      </div>

      {/* Endpoint URL */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {t("admin.mcpTokens.guideEndpoint")}
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
        <li>{t("admin.mcpTokens.guideStep1")}</li>
        <li>{t("admin.mcpTokens.guideStep2")}</li>
        <li>{t("admin.mcpTokens.guideStep3")}</li>
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
                  ? "bg-background text-foreground shadow-sm"
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
        {t("admin.mcpTokens.guideTools")}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function McpTokensManager({ tokens, mcpUrl }: McpTokensManagerProps) {
  const router = useRouter();
  const { t } = useLocale();
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
      toast.success(t("admin.mcpTokens.revoked"));
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
      toast.success(t("admin.mcpTokens.deleted"));
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
      toast.success(t("admin.mcpTokens.bulkDeleted", { count: data.deleted }));
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
      toast.success(t("admin.mcpTokens.scopeUpdated"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update scope");
    }
  };

  return (
    <div className="space-y-8">
      {/* Setup guide */}
      <SetupGuide mcpUrl={mcpUrl} t={t} />

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
            {t("admin.mcpTokens.tokenCreated")}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-secondary px-2 py-1 text-xs font-mono break-all">
              {newToken.access_token}
            </code>
            <CopyButton text={newToken.access_token} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("admin.mcpTokens.tokenOnce")}
          </p>
          <button
            onClick={() => setNewToken(null)}
            className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
          >
            {t("admin.mcpTokens.dismiss")}
          </button>
        </div>
      )}

      {/* Create token form */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-sm font-medium text-foreground">
            {t("admin.mcpTokens.clientName")}
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="e.g. Claude Code"
            className="mt-1 w-full rounded-[var(--radius-widget)] border border-input bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </div>
        <div className="w-32 shrink-0">
          <label className="text-sm font-medium text-foreground">
            {t("admin.mcpTokens.scope")}
          </label>
          <select
            value={createScope}
            onChange={(e) => setCreateScope(e.target.value as McpTokenScope)}
            className="mt-1 w-full rounded-[var(--radius-widget)] border border-input bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="full">{t("admin.mcpTokens.scopeFull")}</option>
            <option value="author">{t("admin.mcpTokens.scopeAuthor")}</option>
          </select>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating || !clientName.trim()}
          className="inline-flex items-center gap-2 rounded-[var(--radius-widget)] bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {creating
            ? t("admin.mcpTokens.creating")
            : t("admin.mcpTokens.create")}
        </button>
      </div>

      {/* Token table */}
      {tokens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <KeyRound
            className="h-10 w-10 mb-3 opacity-40"
            strokeWidth={1.5}
          />
          <p className="text-sm">{t("admin.mcpTokens.empty")}</p>
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
                {t("admin.mcpTokens.bulkDelete", { count: revokedCount })}
              </button>
            </div>
          )}
          <div className="overflow-x-auto rounded-[var(--radius-widget)] border border-border bg-secondary">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t("admin.mcpTokens.colClient")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                    {t("admin.mcpTokens.colPreview")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t("admin.mcpTokens.colScope")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                    {t("admin.mcpTokens.colLastUsed")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                    {t("admin.mcpTokens.colCreated")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t("admin.mcpTokens.colStatus")}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    {t("admin.mcpTokens.colAction")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => {
                  const isRevoked = token.revoked === 1;
                  const isExpired =
                    token.expires_at < Math.floor(Date.now() / 1000);
                  const status = isRevoked
                    ? t("admin.mcpTokens.statusRevoked")
                    : isExpired
                      ? t("admin.mcpTokens.statusExpired")
                      : t("admin.mcpTokens.statusActive");
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
                            {token.scope === "author"
                              ? t("admin.mcpTokens.scopeAuthor")
                              : t("admin.mcpTokens.scopeFull")}
                          </span>
                        ) : (
                          <select
                            value={token.scope}
                            onChange={(e) => handleScopeChange(token.id, e.target.value as McpTokenScope)}
                            className="rounded-md border border-input bg-input px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="full">{t("admin.mcpTokens.scopeFull")}</option>
                            <option value="author">{t("admin.mcpTokens.scopeAuthor")}</option>
                          </select>
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
                            {t("admin.mcpTokens.delete")}
                          </button>
                        ) : (
                          <button
                            onClick={() => setRevokeTargetId(token.id)}
                            className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                          >
                            {t("admin.mcpTokens.revoke")}
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
        title={t("admin.mcpTokens.confirmRevoke")}
        description=""
        destructive
        confirmLabel={t("admin.mcpTokens.revoke")}
        cancelLabel={t("admin.confirm.cancel")}
        onConfirm={() => { if (revokeTargetId) handleRevoke(revokeTargetId); }}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
        title={t("admin.mcpTokens.confirmDelete")}
        description=""
        destructive
        confirmLabel={t("admin.mcpTokens.delete")}
        cancelLabel={t("admin.confirm.cancel")}
        onConfirm={() => { if (deleteTargetId) handleDelete(deleteTargetId); }}
      />

      {/* Bulk delete confirmation dialog */}
      <ConfirmDialog
        open={showBulkDelete}
        onOpenChange={setShowBulkDelete}
        title={t("admin.mcpTokens.confirmBulkDelete", { count: revokedCount })}
        description=""
        destructive
        confirmLabel={t("admin.mcpTokens.deleteBulkConfirm")}
        cancelLabel={t("admin.confirm.cancel")}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
