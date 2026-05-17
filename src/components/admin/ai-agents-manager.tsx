"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import type { Category } from "@/models/types";
import { Button } from "@/components/ui/button";
import {
  DeleteAgentDialog,
  NewAgentModal,
  type AgentWithAvatarUrl,
} from "./ai-agents-helpers";
import { AiAgentsTable } from "./ai-agents-table";

// Re-export so existing consumers can still import NewAgentModal from this module
export { NewAgentModal } from "./ai-agents-helpers";

interface AiAgentsManagerProps {
  agents: AgentWithAvatarUrl[];
  categories: Category[];
  mcpUrl: string;
}

interface PromptInfo {
  agentName: string;
  agentId: string;
  prompt: string;
}

/** Fetch the connection prompt for an agent; falls back to a basic stub on failure. */
async function fetchAgentPrompt(
  agent: AgentWithAvatarUrl,
  mcpUrl: string,
): Promise<PromptInfo> {
  const fallbackPrompt = `Author ID: ${agent.id}\n\nMCP URL: ${mcpUrl}`;
  try {
    const res = await fetch(`/api/admin/ai-agents/${agent.id}/prompt`);
    const data = await res.json();
    return {
      agentName: agent.name,
      agentId: agent.id,
      prompt: data.prompt ?? fallbackPrompt,
    };
  } catch {
    return {
      agentName: agent.name,
      agentId: agent.id,
      prompt: fallbackPrompt,
    };
  }
}

export function AiAgentsManager({
  agents: initialAgents,
  categories: _categories,
  mcpUrl,
}: AiAgentsManagerProps) {
  const router = useRouter();
  const [agents, setAgents] = useState(initialAgents);
  const [newAgent, setNewAgent] = useState<PromptInfo | null>(null);
  const [confirmDelete, setConfirmDelete] =
    useState<AgentWithAvatarUrl | null>(null);
  const [showPromptFor, setShowPromptFor] = useState<PromptInfo | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);

  const handleEdit = (agent: AgentWithAvatarUrl) =>
    router.push(`/admin/ai-agents/${agent.id}`);

  const handleCreate = () => router.push("/admin/ai-agents/new");

  const handleShowPrompt = async (agent: AgentWithAvatarUrl) => {
    setLoadingPrompt(true);
    try {
      setShowPromptFor(await fetchAgentPrompt(agent, mcpUrl));
    } finally {
      setLoadingPrompt(false);
    }
  };

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

  // Check URL for newly created agent (?new=<id>)
  useEffect(() => {
    const url = new URL(window.location.href);
    const newAgentId = url.searchParams.get("new");
    if (!newAgentId) return;

    const agent = agents.find((a) => a.id === newAgentId);
    if (agent) {
      fetchAgentPrompt(agent, mcpUrl).then((info) => setNewAgent(info));
    }
    url.searchParams.delete("new");
    window.history.replaceState({}, "", url.pathname);
  }, [agents, mcpUrl]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">AI 代理作者</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理可发布内容的 AI 代理
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          创建代理
        </Button>
      </div>

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
        <AiAgentsTable
          agents={agents}
          onEdit={handleEdit}
          onShowPrompt={handleShowPrompt}
          onDelete={setConfirmDelete}
        />
      )}

      {newAgent && (
        <NewAgentModal
          agentName={newAgent.agentName}
          agentId={newAgent.agentId}
          prompt={newAgent.prompt}
          onClose={() => setNewAgent(null)}
        />
      )}

      {showPromptFor && (
        <NewAgentModal
          agentName={showPromptFor.agentName}
          agentId={showPromptFor.agentId}
          prompt={showPromptFor.prompt}
          onClose={() => setShowPromptFor(null)}
        />
      )}

      {loadingPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50">
          <div className="rounded-lg bg-background border border-border px-6 py-4">
            <p className="text-sm text-muted-foreground">Loading prompt...</p>
          </div>
        </div>
      )}

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
