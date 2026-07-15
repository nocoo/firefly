"use client";

import { Shield, ShieldCheck } from "lucide-react";
import type { McpToken, McpTokenScope } from "@/models/types";
import { Select } from "@/components/ui/select";

function formatDate(epoch: number | null): string {
  if (!epoch) return "—";
  return new Date(epoch * 1000).toLocaleString();
}

function statusFor(token: McpToken): { label: string; cls: string } {
  const isRevoked = token.revoked === 1;
  const label = isRevoked ? "已撤销" : "有效";
  const cls = isRevoked
    ? "text-muted-foreground"
    : "text-green-600 dark:text-green-400";
  return { label, cls };
}

function ScopeCell({
  token,
  onScopeChange,
}: {
  token: McpToken;
  onScopeChange: (id: string, scope: McpTokenScope) => void;
}) {
  if (token.revoked === 1) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        {token.scope === "author" ? (
          <ShieldCheck className="h-3.5 w-3.5" />
        ) : (
          <Shield className="h-3.5 w-3.5" />
        )}
        {token.scope === "author" ? "作者" : "完整"}
      </span>
    );
  }
  return (
    <Select
      value={token.scope}
      onChange={(e) => onScopeChange(token.id, e.target.value as McpTokenScope)}
      className="h-7 py-1 pl-2 pr-8 text-xs"
    >
      <option value="full">完整</option>
      <option value="author">作者</option>
    </Select>
  );
}

function TokenRow({
  token,
  onScopeChange,
  onRevoke,
  onDelete,
}: {
  token: McpToken;
  onScopeChange: (id: string, scope: McpTokenScope) => void;
  onRevoke: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { label, cls } = statusFor(token);
  const isRevoked = token.revoked === 1;

  return (
    <tr className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
      <td className="px-4 py-3 font-medium">{token.client_name ?? "—"}</td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono">
          {token.access_token_preview}…
        </code>
      </td>
      <td className="px-4 py-3">
        <ScopeCell token={token} onScopeChange={onScopeChange} />
      </td>
      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
        {formatDate(token.last_used_at)}
      </td>
      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
        {formatDate(token.created_at)}
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs font-medium ${cls}`}>{label}</span>
      </td>
      <td className="px-4 py-3 text-right">
        {isRevoked ? (
          <button type="button"
            onClick={() => onDelete(token.id)}
            className="text-xs text-destructive hover:text-destructive/80 transition-colors"
          >
            删除
          </button>
        ) : (
          <button type="button"
            onClick={() => onRevoke(token.id)}
            className="text-xs text-destructive hover:text-destructive/80 transition-colors"
          >
            撤销
          </button>
        )}
      </td>
    </tr>
  );
}

export function McpTokensTable({
  tokens,
  onScopeChange,
  onRevoke,
  onDelete,
}: {
  tokens: McpToken[];
  onScopeChange: (id: string, scope: McpTokenScope) => void;
  onRevoke: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-widget border border-border bg-secondary">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">客户端</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">令牌</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">权限</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">最后使用</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">创建时间</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">状态</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground"></th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <TokenRow
              key={token.id}
              token={token}
              onScopeChange={onScopeChange}
              onRevoke={onRevoke}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
