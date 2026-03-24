"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, Copy, Check } from "lucide-react";
import type { McpToken } from "@/models/types";
import { useLocale } from "@/i18n/context";

interface McpTokensManagerProps {
  tokens: McpToken[];
}

export function McpTokensManager({ tokens }: McpTokensManagerProps) {
  const router = useRouter();
  const { t } = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [clientName, setClientName] = useState("");
  const [newToken, setNewToken] = useState<{ access_token: string; id: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const formatDate = (epoch: number | null) => {
    if (!epoch) return "—";
    return new Date(epoch * 1000).toLocaleString();
  };

  const handleRevoke = async (id: string) => {
    if (!confirm(t("admin.mcpTokens.confirmRevoke"))) return;
    setError(null);
    try {
      const res = await fetch(`/api/mcp/tokens/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to revoke token");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke token");
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
        body: JSON.stringify({ client_name: clientName.trim() }),
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

  const handleCopy = async () => {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken.access_token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
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
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="Copy"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </button>
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
            className="mt-1 w-full rounded-[var(--radius-widget)] border border-border bg-secondary px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={creating || !clientName.trim()}
          className="inline-flex items-center gap-2 rounded-[var(--radius-widget)] bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {creating ? t("admin.mcpTokens.creating") : t("admin.mcpTokens.create")}
        </button>
      </div>

      {/* Token table */}
      {tokens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <KeyRound className="h-10 w-10 mb-3 opacity-40" strokeWidth={1.5} />
          <p className="text-sm">{t("admin.mcpTokens.empty")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-widget)] border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("admin.mcpTokens.colClient")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                  {t("admin.mcpTokens.colPreview")}
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
                const isExpired = token.expires_at < Math.floor(Date.now() / 1000);
                const status = isRevoked
                  ? t("admin.mcpTokens.statusRevoked")
                  : isExpired
                    ? t("admin.mcpTokens.statusExpired")
                    : t("admin.mcpTokens.statusActive");
                const statusClass = isRevoked || isExpired
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
                      {!isRevoked && (
                        <button
                          onClick={() => handleRevoke(token.id)}
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
      )}
    </div>
  );
}
