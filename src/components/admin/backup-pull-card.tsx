"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { BackupCopyButton } from "./backup-page-helpers";

export function BackupPullCard({ initialPullKey }: { initialPullKey: string | null }) {
  const [pullKey, setPullKey] = useState(initialPullKey);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/backup/pull-key", { method: "POST" });
      const data = await res.json();
      setPullKey(data.key);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    setLoading(true);
    try {
      await fetch("/api/backup/pull-key", { method: "DELETE" });
      setPullKey(null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const pullWebhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/backup/pull`
      : "/api/backup/pull";

  return (
    <div className="rounded-card bg-secondary p-6 space-y-6">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-yellow-500" />
        <h2 className="text-lg font-medium text-foreground">拉取 Webhook</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        生成凭证供 Backy 定时拉取触发备份推送。
      </p>

      {pullKey ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Webhook URL
              </label>
              <BackupCopyButton text={pullWebhookUrl} />
            </div>
            <code className="block text-xs bg-muted rounded px-2 py-1.5 break-all">
              {pullWebhookUrl}
            </code>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                X-Webhook-Key
              </label>
              <BackupCopyButton text={pullKey} />
            </div>
            <code className="block text-xs bg-muted rounded px-2 py-1.5 break-all">
              {pullKey}
            </code>
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-xs font-mono text-muted-foreground">
            <div>curl -X POST {pullWebhookUrl} \</div>
            <div className="pl-4">-H &quot;X-Webhook-Key: {pullKey}&quot;</div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={loading}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              重新生成
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRevoke}
              disabled={loading}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5 text-red-500" />
              撤销
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={handleGenerate} disabled={loading}>
          <KeyRound className="h-4 w-4 mr-2" />
          生成凭证
        </Button>
      )}
    </div>
  );
}
