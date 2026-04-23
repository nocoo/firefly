"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Plus,
  Copy,
  Check,
  Pencil,
  Users,
  Folder,
  Trash2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import type { AiAgentWithCategory, Category } from "@/models/types";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Extended type with pre-computed avatar URL from server
interface AgentWithAvatarUrl extends AiAgentWithCategory {
  avatarUrl: string | null;
}

interface AiAgentsManagerProps {
  agents: AgentWithAvatarUrl[];
  categories: Category[];
  mcpUrl: string;
}

// ---------------------------------------------------------------------------
// Delete confirmation dialog
// ---------------------------------------------------------------------------

function DeleteAgentDialog({
  agent,
  open,
  onOpenChange,
  onConfirm,
}: {
  agent: AgentWithAvatarUrl | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  if (!agent) return null;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="删除代理"
      description={`确定删除「${agent.name}」吗？此操作不可撤销。`}
      destructive
      onConfirm={onConfirm}
    />
  );
}

// ---------------------------------------------------------------------------
// Copy button (reusable)
// ---------------------------------------------------------------------------

export function CopyButton({ text, className }: { text: string; className?: string }) {
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
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// New Agent Modal — shows the author ID and prompt after creation
// ---------------------------------------------------------------------------

export function NewAgentModal({
  agentName,
  agentId,
  prompt,
  onClose,
}: {
  agentName: string;
  agentId: string;
  prompt: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50">
      <div className="mx-4 w-full max-w-lg rounded-lg bg-background border border-border shadow-lg">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{agentName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            代理创建成功！复制以下信息以连接。
          </p>
        </div>
        <div className="space-y-4 px-6 py-4">
          {/* Author ID */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              作者 ID
            </label>
            <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2">
              <code className="flex-1 text-xs font-mono text-foreground break-all select-all">
                {agentId}
              </code>
              <CopyButton text={agentId} />
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              连接提示
            </label>
            <div className="mt-1 rounded-md border border-border bg-secondary">
              <div className="flex items-center justify-end px-3 py-1.5 border-b border-border">
                <CopyButton text={prompt} />
              </div>
              <pre className="max-h-[200px] overflow-auto p-3 text-xs font-mono leading-relaxed text-foreground whitespace-pre-wrap">
                {prompt}
              </pre>
            </div>
          </div>
        </div>
        <div className="border-t border-border px-6 py-3 flex justify-end">
          <Button variant="default" onClick={onClose}>
            完成
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent row
// ---------------------------------------------------------------------------

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
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="编辑"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onShowPrompt}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="显示提示词"
          >
            <FileText className="h-4 w-4" />
          </button>
          {agent.post_count === 0 && (
            <button
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AiAgentsManager({
  agents: initialAgents,
  categories: _categories,
  mcpUrl,
}: AiAgentsManagerProps) {
  const router = useRouter();
  const [agents, setAgents] = useState(initialAgents);
  const [newAgent, setNewAgent] = useState<{
    agentName: string;
    agentId: string;
    prompt: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AgentWithAvatarUrl | null>(null);
  const [showPromptFor, setShowPromptFor] = useState<{
    agentName: string;
    agentId: string;
    prompt: string;
  } | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);

  // Edit agent
  const handleEdit = (agentId: string) => {
    router.push(`/admin/ai-agents/${agentId}`);
  };

  // Create new agent
  const handleCreate = () => {
    router.push("/admin/ai-agents/new");
  };

  // Show prompt for existing agent — fetch from API
  const handleShowPrompt = async (agent: AgentWithAvatarUrl) => {
    setLoadingPrompt(true);
    try {
      const res = await fetch(`/api/admin/ai-agents/${agent.id}/prompt`);
      const data = await res.json();
      setShowPromptFor({
        agentName: agent.name,
        agentId: agent.id,
        prompt: data.prompt ?? `Author ID: ${agent.id}\n\nMCP URL: ${mcpUrl}`,
      });
    } catch {
      // Fallback to basic info
      setShowPromptFor({
        agentName: agent.name,
        agentId: agent.id,
        prompt: `Author ID: ${agent.id}\n\nMCP URL: ${mcpUrl}`,
      });
    } finally {
      setLoadingPrompt(false);
    }
  };

  // Delete agent
  const handleDelete = async (agent: AgentWithAvatarUrl) => {
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/admin/ai-agents/${agent.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setAgents((prev) => prev.filter((a) => a.id !== agent.id));
      toast.success("代理已删除");
    } catch {
      toast.error("删除代理失败");
    }
  };

  // Check URL for newly created agent
  useEffect(() => {
    const url = new URL(window.location.href);
    const newAgentId = url.searchParams.get("new");
    if (newAgentId) {
      const agent = agents.find((a) => a.id === newAgentId);
      if (agent) {
        // Fetch the full prompt from API
        fetch(`/api/admin/ai-agents/${newAgentId}/prompt`)
          .then((res) => res.json())
          .then((data) => {
            if (data.prompt) {
              setNewAgent({
                agentName: agent.name,
                agentId: agent.id,
                prompt: data.prompt,
              });
            }
          })
          .catch(() => {
            // Fallback to basic prompt
            setNewAgent({
              agentName: agent.name,
              agentId: agent.id,
              prompt: `Author ID: ${agent.id}\n\nMCP URL: ${mcpUrl}`,
            });
          });
      }
      // Clean up URL
      url.searchParams.delete("new");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [agents, mcpUrl]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            AI 代理作者
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理可发布内容的 AI 代理
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          创建代理
        </Button>
      </div>

      {/* Table or empty state */}
      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-card bg-secondary py-12">
          <Users className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">
            还没有 AI 代理。创建一个以允许 AI 发布内容。
          </p>
          <Button variant="outline" className="mt-4" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            创建代理
          </Button>
        </div>
      ) : (
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
                  onEdit={() => handleEdit(agent.id)}
                  onShowPrompt={() => handleShowPrompt(agent)}
                  onDelete={() => setConfirmDelete(agent)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New agent modal */}
      {newAgent && (
        <NewAgentModal
          agentName={newAgent.agentName}
          agentId={newAgent.agentId}
          prompt={newAgent.prompt}
          onClose={() => setNewAgent(null)}
        />
      )}

      {/* Show prompt modal for existing agent */}
      {showPromptFor && (
        <NewAgentModal
          agentName={showPromptFor.agentName}
          agentId={showPromptFor.agentId}
          prompt={showPromptFor.prompt}
          onClose={() => setShowPromptFor(null)}
        />
      )}

      {/* Loading indicator for prompt fetch */}
      {loadingPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50">
          <div className="rounded-lg bg-background border border-border px-6 py-4">
            <p className="text-sm text-muted-foreground">Loading prompt...</p>
          </div>
        </div>
      )}

      {/* Confirm delete dialog */}
      <DeleteAgentDialog
        agent={confirmDelete}
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) handleDelete(confirmDelete);
        }}
      />
    </div>
  );
}
