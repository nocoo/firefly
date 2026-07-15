"use client";

import Image from "next/image";
import { FileText, Folder, Pencil, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CopyButton, type AgentWithAvatarUrl } from "./ai-agents-helpers";

function AgentRow({
  agent,
  onEdit,
  onShowPrompt,
  onDelete,
}: {
  agent: AgentWithAvatarUrl;
  onEdit: () => void;
  onShowPrompt: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {agent.avatarUrl ? (
            <Image
              src={agent.avatarUrl}
              alt={agent.name}
              width={32}
              height={32}
              className="rounded-full"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Users className="h-4 w-4" />
            </div>
          )}
          <div>
            <div className="font-medium text-foreground">{agent.name}</div>
            <div className="text-xs text-muted-foreground">{agent.slug}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Folder className="h-3.5 w-3.5" />
          <span>{agent.category_name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono text-muted-foreground">
            {agent.id.slice(0, 8)}...
          </code>
          <CopyButton text={agent.id} />
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant="secondary">
          {agent.post_count} {agent.post_count === 1 ? "post" : "posts"}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button type="button"
            onClick={onEdit}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="编辑"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button"
            onClick={onShowPrompt}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="显示提示词"
          >
            <FileText className="h-4 w-4" />
          </button>
          {agent.post_count === 0 && (
            <button type="button"
              onClick={onDelete}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="删除"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function AiAgentsTable({
  agents,
  onEdit,
  onShowPrompt,
  onDelete,
}: {
  agents: AgentWithAvatarUrl[];
  onEdit: (agent: AgentWithAvatarUrl) => void;
  onShowPrompt: (agent: AgentWithAvatarUrl) => void;
  onDelete: (agent: AgentWithAvatarUrl) => void;
}) {
  return (
    <div className="rounded-card bg-secondary p-1 overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
              名称
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
              绑定分类
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
              Author ID
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
              文章数
            </th>
            <th className="px-4 py-2 w-24"></th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              onEdit={() => onEdit(agent)}
              onShowPrompt={() => onShowPrompt(agent)}
              onDelete={() => onDelete(agent)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
