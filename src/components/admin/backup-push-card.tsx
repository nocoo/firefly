"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  CloudUpload,
  Pencil,
  Plug,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  BackyHistoryResponse,
  BackyPushDetail,
} from "@/models/backup";
import { HistoryRow, StatusMessage } from "./backup-page-helpers";

type Message = { type: "success" | "error" | "info"; text: string };

interface PushConfig {
  webhookUrl: string;
  maskedApiKey: string;
}

interface BackupPushCardProps {
  initialConfig: PushConfig | null;
}

function PushDetailBox({ detail }: { detail: BackyPushDetail }) {
  if (!detail.request) return null;
  const { tag, fileName, fileSizeBytes, backupStats } = detail.request;
  return (
    <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1 font-mono">
      <div>Tag: {tag}</div>
      <div>File: {fileName}</div>
      <div>
        Size:{" "}
        {fileSizeBytes < 1024
          ? `${fileSizeBytes} B`
          : `${(fileSizeBytes / 1024).toFixed(1)} KB`}
      </div>
      {detail.durationMs && <div>Duration: {detail.durationMs}ms</div>}
      <div className="text-muted-foreground">
        {Object.entries(backupStats)
          .map(([k, v]) => `${v} ${k}`)
          .join(" · ")}
      </div>
    </div>
  );
}

function HistorySection({
  history,
  loading,
  onRefresh,
}: {
  history: BackyHistoryResponse | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="border-t border-border pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">备份记录</h3>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1", loading && "animate-spin")} />
          刷新
        </Button>
      </div>

      {history ? (
        history.recent_backups.length > 0 ? (
          <div className="divide-y divide-border">
            {history.recent_backups.map((entry) => (
              <HistoryRow key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无备份记录</p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          推送备份后将显示远程备份记录。
        </p>
      )}
    </div>
  );
}

export function BackupPushCard({ initialConfig }: BackupPushCardProps) {
  // Configured / editing state
  const [configured, setConfigured] = useState(!!initialConfig);
  const [webhookUrl, setWebhookUrl] = useState(initialConfig?.webhookUrl ?? "");
  const [maskedApiKey, setMaskedApiKey] = useState(
    initialConfig?.maskedApiKey ?? "",
  );
  const [editMode, setEditMode] = useState(!initialConfig);
  const [editUrl, setEditUrl] = useState("");
  const [editKey, setEditKey] = useState("");

  // Action state
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  // Push result + history
  const [pushDetail, setPushDetail] = useState<BackyPushDetail | null>(null);
  const [history, setHistory] = useState<BackyHistoryResponse | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/backup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl: editUrl,
          ...(editKey ? { apiKey: editKey } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "保存失败");
      }
      const getRes = await fetch("/api/backup");
      const config = await getRes.json();
      setConfigured(true);
      setWebhookUrl(config.webhookUrl);
      setMaskedApiKey(config.apiKey);
      setEditMode(false);
      setEditUrl("");
      setEditKey("");
      setMessage({ type: "success", text: "配置已保存" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "保存失败",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await fetch("/api/backup", { method: "DELETE" });
      setConfigured(false);
      setWebhookUrl("");
      setMaskedApiKey("");
      setEditMode(true);
      setEditUrl("");
      setEditKey("");
      setHistory(null);
      setPushDetail(null);
      setMessage(null);
    } catch {
      // ignore
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/backup/test", { method: "POST" });
      const data = await res.json();
      setMessage(
        data.ok
          ? { type: "success", text: "连接成功" }
          : { type: "error", text: `连接失败 (${data.status})` },
      );
    } catch {
      setMessage({ type: "error", text: "连接失败" });
    } finally {
      setTesting(false);
    }
  };

  const handlePush = async () => {
    setPushing(true);
    setMessage(null);
    setPushDetail(null);
    try {
      const res = await fetch("/api/backup/push", { method: "POST" });
      const detail = (await res.json()) as BackyPushDetail;
      setPushDetail(detail);
      if (detail.ok) {
        setMessage({ type: "success", text: "推送成功" });
        if (detail.history) setHistory(detail.history);
      } else {
        setMessage({ type: "error", text: detail.message });
      }
    } catch {
      setMessage({ type: "error", text: "推送失败" });
    } finally {
      setPushing(false);
    }
  };

  const handleRefreshHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/backup/history");
      if (res.ok) {
        setHistory((await res.json()) as BackyHistoryResponse);
      }
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  const enterEdit = () => {
    setEditUrl(webhookUrl);
    setEditKey("");
    setEditMode(true);
    setMessage(null);
  };

  const cancelEdit = () => {
    if (configured) {
      setEditMode(false);
      setMessage(null);
    }
  };

  return (
    <div className="rounded-card bg-secondary p-6 space-y-6">
      <div className="flex items-center gap-2">
        <CloudUpload className="h-5 w-5 text-purple-500" />
        <h2 className="text-lg font-medium text-foreground">远程备份</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        将博客数据推送至 Backy 远程备份服务。
      </p>

      {editMode ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Webhook URL
            </label>
            <Input
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              placeholder="https://example.com/api/webhook/..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">API Key</label>
            <Input
              type="password"
              value={editKey}
              onChange={(e) => setEditKey(e.target.value)}
              placeholder={configured ? "留空则保持不变" : "Bearer token"}
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saving || !editUrl || (!configured && !editKey)}
            >
              {saving ? "保存中..." : "保存"}
            </Button>
            {configured && (
              <Button variant="ghost" onClick={cancelEdit}>
                <X className="h-4 w-4 mr-1" />
                取消
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <code className="text-xs text-muted-foreground truncate block max-w-md">
                  {webhookUrl}
                </code>
              </div>
              <div className="text-xs text-muted-foreground">
                Key: {maskedApiKey}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={enterEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDelete}>
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
              <Plug className="h-3.5 w-3.5 mr-1.5" />
              {testing ? "测试中..." : "测试连接"}
            </Button>
            <Button size="sm" onClick={handlePush} disabled={pushing}>
              <CloudUpload className="h-3.5 w-3.5 mr-1.5" />
              {pushing ? "推送中..." : "推送备份"}
            </Button>
          </div>

          {message && <StatusMessage type={message.type} text={message.text} />}

          {pushDetail && <PushDetailBox detail={pushDetail} />}

          <HistorySection
            history={history}
            loading={loadingHistory}
            onRefresh={handleRefreshHistory}
          />
        </div>
      )}
    </div>
  );
}
