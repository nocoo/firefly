"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { AiAgentWithCategory } from "@/models/types";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";

/** Extended agent type with pre-computed avatar URL from server */
export interface AgentWithAvatarUrl extends AiAgentWithCategory {
  avatarUrl: string | null;
}

export function CopyButton({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
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

export function DeleteAgentDialog({
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
