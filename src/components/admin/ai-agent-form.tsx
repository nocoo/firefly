"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AiAgent, Category } from "@/models/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { NewAgentModal } from "@/components/admin/ai-agents-manager";
import { AgentAvatarUploader } from "./ai-agent-avatar-uploader";

interface AiAgentFormProps {
  agent: AiAgent | null;
  categories: Category[];
  initialAvatarUrl: string | null;
}

interface NewAgentInfo {
  agentName: string;
  agentId: string;
  prompt: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function buildSaveBody(args: {
  isNew: boolean;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
}): Record<string, unknown> {
  const { isNew, name, slug, description, categoryId } = args;
  const base = {
    name: name.trim(),
    slug: slug.trim(),
    description: description.trim() || null,
  };
  return isNew ? { ...base, categoryId } : base;
}

export function AiAgentForm({
  agent,
  categories,
  initialAvatarUrl,
}: AiAgentFormProps) {
  const router = useRouter();
  const isNew = !agent;

  // Form state
  const [name, setName] = useState(agent?.name ?? "");
  const [slug, setSlug] = useState(agent?.slug ?? "");
  const [description, setDescription] = useState(agent?.description ?? "");
  const [categoryId, setCategoryId] = useState(agent?.category_id ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);

  // UI state
  const [saving, setSaving] = useState(false);
  const [newAgent, setNewAgent] = useState<NewAgentInfo | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!agent);

  // Auto-generate slug from name (only if not manually edited)
  useEffect(() => {
    if (!slugManuallyEdited && !agent) {
      setSlug(slugify(name));
    }
  }, [name, slugManuallyEdited, agent]);

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    setSlug(slugify(value));
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error("请输入名称");
    if (!slug.trim()) return toast.error("请输入标识符");
    if (!categoryId) return toast.error("请选择分类");

    setSaving(true);
    try {
      const body = buildSaveBody({
        isNew,
        name,
        slug,
        description,
        categoryId,
      });
      const url = isNew
        ? "/api/admin/ai-agents"
        : `/api/admin/ai-agents/${agent.id}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }

      const data = await res.json();

      if (isNew) {
        setNewAgent({
          agentName: data.agent.name,
          agentId: data.agent.id,
          prompt: data.prompt,
        });
      } else {
        toast.success("代理保存成功");
        router.push("/admin/ai-agents");
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save agent");
    } finally {
      setSaving(false);
    }
  };

  const handleAgentModalClose = () => {
    setNewAgent(null);
    router.push("/admin/ai-agents");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
        <h1 className="text-xl font-semibold text-foreground">
          {isNew ? "创建 AI 代理" : "编辑 AI 代理"}
        </h1>
      </div>

      <div className="rounded-lg bg-secondary p-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left column: Basic info */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">名称 *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：科技写手"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">标识符 *</label>
              <Input
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="如：tech-writer"
                className="mt-1 font-mono text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                URL 友好的标识符（小写字母、数字、连字符）
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">分类 *</label>
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1"
                disabled={!isNew}
              >
                <option value="">选择分类...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {isNew ? "代理只能在此分类下创建文章" : "分类创建后无法更改"}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="代理的可选描述"
                rows={3}
                className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>

            {!isNew && agent && (
              <div>
                <label className="text-sm font-medium text-foreground">
                  Author ID
                </label>
                <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2">
                  <code className="flex-1 text-xs font-mono text-foreground select-all">
                    {agent.id}
                  </code>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  通过 MCP 创建文章时，在 author_id 字段使用此 ID
                </p>
              </div>
            )}
          </div>

          {/* Right column: Avatar (only for edit) */}
          {!isNew && agent && (
            <AgentAvatarUploader
              agentId={agent.id}
              agentName={name}
              avatarUrl={avatarUrl}
              onAvatarChange={setAvatarUrl}
            />
          )}
        </div>

        <div className="mt-6 flex items-center gap-3 border-t border-border pt-6">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isNew ? "创建代理" : "保存更改"}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/admin/ai-agents")}
          >
            取消
          </Button>
        </div>
      </div>

      {newAgent && (
        <NewAgentModal
          agentName={newAgent.agentName}
          agentId={newAgent.agentId}
          prompt={newAgent.prompt}
          onClose={handleAgentModalClose}
        />
      )}
    </div>
  );
}
