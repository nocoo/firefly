"use client";

import { Plus } from "@nocoo/basalt/icons";
import type { McpTokenScope } from "@/models/types";
import { Input } from "@nocoo/basalt/components/input";
import { Field } from "@nocoo/basalt/components/field";
import { Button } from "@nocoo/basalt/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nocoo/basalt/components/select";

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
      <Field htmlFor="mcp-client-name" label="客户端名称" className="flex-1 space-y-1">
        <Input
          id="mcp-client-name"
          type="text"
          value={clientName}
          onChange={(e) => onClientNameChange(e.target.value)}
          placeholder="e.g. Claude Code"
          onKeyDown={(e) => e.key === "Enter" && onCreate()}
        />
      </Field>
      <div className="w-32 shrink-0 space-y-1">
        <label htmlFor="mcp-scope" className="text-sm font-medium text-basalt-foreground">
          权限
        </label>
        <Select value={scope} onValueChange={(next) => onScopeChange(next as McpTokenScope)}>
          <SelectTrigger id="mcp-scope">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full">完整</SelectItem>
            <SelectItem value="author">作者</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        onClick={onCreate}
        disabled={creating || !clientName.trim()}
        loading={creating}
        icon={<Plus />}
      >
        {creating ? "创建中…" : "创建令牌"}
      </Button>
    </div>
  );
}
