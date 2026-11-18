"use client";

import Image from "next/image";
import { FileText, Folder, Pencil, Trash2, Users } from "@nocoo/basalt/icons";
import { Badge } from "@nocoo/basalt/components/badge";
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
    <tr className="border-b border-basalt-border last:border-0 hover:bg-basalt-accent/50 transition-colors">
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-basalt-secondary text-basalt-muted-foreground">
              <Users className="h-4 w-4" />
            </div>
          )}
          <div>
            <div className="font-medium text-basalt-foreground">{agent.name}</div>
            <div className="text-xs text-basalt-muted-foreground">{agent.slug}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm text-basalt-muted-foreground">
          <Folder className="h-3.5 w-3.5" />
          <span>{agent.category_name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono text-basalt-muted-foreground">
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
            className="p-1.5 rounded-md text-basalt-muted-foreground hover:bg-basalt-accent hover:text-basalt-foreground transition-colors"
            title="编辑"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button"
            onClick={onShowPrompt}
            className="p-1.5 rounded-md text-basalt-muted-foreground hover:bg-basalt-accent hover:text-basalt-foreground transition-colors"
            title="显示提示词"
          >
            <FileText className="h-4 w-4" />
          </button>
          {agent.post_count === 0 && (
            <button type="button"
              onClick={onDelete}
              className="p-1.5 rounded-md text-basalt-muted-foreground hover:bg-basalt-destructive/10 hover:text-basalt-destructive transition-colors"
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
    <div className="rounded-card bg-basalt-secondary p-1 overflow-x-auto ring-1 ring-basalt-border/80 shadow-basalt-card">
      <table className="w-full">
        <thead>
          <tr className="border-b border-basalt-border">
            <th className="px-4 py-2 text-left text-xs font-medium text-basalt-muted-foreground">
              名称
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-basalt-muted-foreground">
              绑定分类
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-basalt-muted-foreground">
              Author ID
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-basalt-muted-foreground">
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
