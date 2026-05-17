"use client";

import { Plus } from "lucide-react";
import type { McpTokenScope } from "@/models/types";
import { Select } from "@/components/ui/select";

/**
 * Inline create-token form: client-name input + scope select + create button.
 */
export function McpTokenCreateForm({
  clientName,
  scope,
  creating,
  onClientNameChange,
  onScopeChange,
  onCreate,
}: {
  clientName: string;
  scope: McpTokenScope;
  creating: boolean;
  onClientNameChange: (next: string) => void;
  onScopeChange: (next: McpTokenScope) => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <label className="text-sm font-medium text-foreground">客户端名称</label>
        <input
          type="text"
          value={clientName}
          onChange={(e) => onClientNameChange(e.target.value)}
          placeholder="e.g. Claude Code"
          className="mt-1 w-full rounded-widget border border-border bg-secondary px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          onKeyDown={(e) => e.key === "Enter" && onCreate()}
        />
      </div>
      <div className="w-32 shrink-0">
        <label className="text-sm font-medium text-foreground">权限</label>
        <Select
          value={scope}
          onChange={(e) => onScopeChange(e.target.value as McpTokenScope)}
          className="mt-1"
        >
          <option value="full">完整</option>
          <option value="author">作者</option>
        </Select>
      </div>
      <button
        onClick={onCreate}
        disabled={creating || !clientName.trim()}
        className="inline-flex items-center gap-2 rounded-widget bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        {creating ? "创建中…" : "创建令牌"}
      </button>
    </div>
  );
}
