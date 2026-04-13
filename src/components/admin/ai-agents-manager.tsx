"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
import { useLocale } from "@/i18n/context";
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
  t,
}: {
  agent: AgentWithAvatarUrl | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  t: (key: string) => string;
}) {
  if (!agent) return null;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("admin.aiAgents.deleteAgent")}
      description={t("admin.aiAgents.deleteConfirm").replace("{name}", agent.name)}
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
  t,
}: {
  agentName: string;
  agentId: string;
  prompt: string;
  onClose: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-lg bg-background border border-border shadow-lg">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{agentName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("admin.aiAgents.agentCreated")}
          </p>
        </div>
        <div className="space-y-4 px-6 py-4">
          {/* Author ID */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Author ID
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
              {t("admin.aiAgents.promptTitle")}
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
            {t("common.done")}
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
  t,
}: {
  agent: AgentWithAvatarUrl;
  onEdit: () => void;
  onShowPrompt: () => void;
  onDelete: () => void;
  t: (key: string) => string;
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
            title={t("admin.aiAgents.edit")}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onShowPrompt}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title={t("admin.aiAgents.showPrompt")}
          >
            <FileText className="h-4 w-4" />
          </button>
          {agent.post_count === 0 && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title={t("admin.aiAgents.delete")}
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
  const { t } = useLocale();
  const [agents, setAgents] = useState(initialAgents);
  const [newAgent, setNewAgent] = useState<{
    agentName: string;
    agentId: string;
    prompt: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AgentWithAvatarUrl | null>(null);
  const [showPromptFor, setShowPromptFor] = useState<AgentWithAvatarUrl | null>(null);

  // Generate prompt for an existing agent
  const generatePrompt = useCallback((agent: AgentWithAvatarUrl): string => {
    // Import the prompt generator function client-side is not ideal,
    // so we replicate the key parts here
    return `你是「${agent.name}」。

Author ID: ${agent.id}

在所有 MCP 工具调用中带上 author_id 参数。

MCP URL: ${mcpUrl}`;
  }, [mcpUrl]);

  // Edit agent
  const handleEdit = (agentId: string) => {
    router.push(`/admin/ai-agents/${agentId}`);
  };

  // Create new agent
  const handleCreate = () => {
    router.push("/admin/ai-agents/new");
  };

  // Show prompt for existing agent
  const handleShowPrompt = (agent: AgentWithAvatarUrl) => {
    setShowPromptFor(agent);
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
      toast.success(t("admin.aiAgents.deleted"));
    } catch {
      toast.error(t("admin.aiAgents.deleteFailed"));
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
              prompt: generatePrompt(agent),
            });
          });
      }
      // Clean up URL
      url.searchParams.delete("new");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [agents, generatePrompt, mcpUrl]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {t("admin.aiAgents.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("admin.aiAgents.subtitle")}
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("admin.aiAgents.create")}
        </Button>
      </div>

      {/* Table or empty state */}
      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
          <Users className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">
            {t("admin.aiAgents.empty")}
          </p>
          <Button variant="outline" className="mt-4" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t("admin.aiAgents.create")}
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                  {t("admin.aiAgents.name")}
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                  {t("admin.aiAgents.category")}
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                  Author ID
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                  {t("admin.aiAgents.posts")}
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
                  t={t}
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
          t={t}
        />
      )}

      {/* Show prompt modal for existing agent */}
      {showPromptFor && (
        <NewAgentModal
          agentName={showPromptFor.name}
          agentId={showPromptFor.id}
          prompt={generatePrompt(showPromptFor)}
          onClose={() => setShowPromptFor(null)}
          t={t}
        />
      )}

      {/* Confirm delete dialog */}
      <DeleteAgentDialog
        agent={confirmDelete}
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) handleDelete(confirmDelete);
        }}
        t={t}
      />
    </div>
  );
}
