"use client";

import { useState, useCallback } from "react";
import { useLocale } from "@/i18n/context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  CloudUpload,
  RefreshCw,
  Plug,
  Trash2,
  Pencil,
  X,
  Copy,
  Check,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BackyPushDetail, BackyHistoryResponse, BackyBackupEntry } from "@/models/backup";
import { formatFileSize, formatTimeAgo } from "@/models/backup";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BackupPageProps {
  initialConfig: {
    webhookUrl: string;
    maskedApiKey: string;
  } | null;
  initialPullKey: string | null;
}

// ---------------------------------------------------------------------------
// Status message component
// ---------------------------------------------------------------------------

function StatusMessage({ type, text }: { type: "success" | "error" | "info"; text: string }) {
  return (
    <p
      className={cn(
        "text-sm",
        type === "success" && "text-green-600 dark:text-green-400",
        type === "error" && "text-red-600 dark:text-red-400",
        type === "info" && "text-muted-foreground",
      )}
    >
      {text}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Copy button component
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// History entry row
// ---------------------------------------------------------------------------

function HistoryRow({ entry }: { entry: BackyBackupEntry }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
            entry.environment === "prod"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
          )}
        >
          {entry.environment}
        </span>
        <span className="truncate text-muted-foreground font-mono text-xs">
          {entry.tag}
        </span>
      </div>
      <div className="flex items-center gap-4 shrink-0 text-muted-foreground text-xs">
        <span>{formatFileSize(entry.file_size)}</span>
        <span>{formatTimeAgo(entry.created_at)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BackupPage({ initialConfig, initialPullKey }: BackupPageProps) {
  const { t } = useLocale();

  // Push config state
  const [configured, setConfigured] = useState(!!initialConfig);
  const [webhookUrl, setWebhookUrl] = useState(initialConfig?.webhookUrl ?? "");
  const [maskedApiKey, setMaskedApiKey] = useState(initialConfig?.maskedApiKey ?? "");
  const [editMode, setEditMode] = useState(!initialConfig);
  const [editUrl, setEditUrl] = useState("");
  const [editKey, setEditKey] = useState("");

  // Action state
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Push result
  const [pushDetail, setPushDetail] = useState<BackyPushDetail | null>(null);

  // History
  const [history, setHistory] = useState<BackyHistoryResponse | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Pull key state
  const [pullKey, setPullKey] = useState(initialPullKey);
  const [pullKeyLoading, setPullKeyLoading] = useState(false);

  // ── Save config ──
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/backup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: editUrl, apiKey: editKey }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? t("admin.backup.saveFailed"));
      }

      // Refresh to get masked key
      const getRes = await fetch("/api/backup");
      const config = await getRes.json();

      setConfigured(true);
      setWebhookUrl(config.webhookUrl);
      setMaskedApiKey(config.apiKey);
      setEditMode(false);
      setEditUrl("");
      setEditKey("");
      setMessage({ type: "success", text: t("admin.backup.saved") });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("admin.backup.saveFailed") });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete config ──
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

  // ── Test connection ──
  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/backup/test", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "success", text: t("admin.backup.testSuccess") });
      } else {
        setMessage({ type: "error", text: `${t("admin.backup.testFailed")} (${data.status})` });
      }
    } catch {
      setMessage({ type: "error", text: t("admin.backup.testFailed") });
    } finally {
      setTesting(false);
    }
  };

  // ── Push backup ──
  const handlePush = async () => {
    setPushing(true);
    setMessage(null);
    setPushDetail(null);
    try {
      const res = await fetch("/api/backup/push", { method: "POST" });
      const detail = (await res.json()) as BackyPushDetail;
      setPushDetail(detail);

      if (detail.ok) {
        setMessage({ type: "success", text: t("admin.backup.pushSuccess") });
        if (detail.history) {
          setHistory(detail.history);
        }
      } else {
        setMessage({ type: "error", text: detail.message });
      }
    } catch {
      setMessage({ type: "error", text: t("admin.backup.pushFailed") });
    } finally {
      setPushing(false);
    }
  };

  // ── Fetch history ──
  const handleRefreshHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/backup/history");
      if (res.ok) {
        const data = (await res.json()) as BackyHistoryResponse;
        setHistory(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  // ── Pull key actions ──
  const handleGeneratePullKey = async () => {
    setPullKeyLoading(true);
    try {
      const res = await fetch("/api/backup/pull-key", { method: "POST" });
      const data = await res.json();
      setPullKey(data.key);
    } catch {
      // ignore
    } finally {
      setPullKeyLoading(false);
    }
  };

  const handleRevokePullKey = async () => {
    setPullKeyLoading(true);
    try {
      await fetch("/api/backup/pull-key", { method: "DELETE" });
      setPullKey(null);
    } catch {
      // ignore
    } finally {
      setPullKeyLoading(false);
    }
  };

  // ── Enter edit mode ──
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

  // Pull webhook URL for display
  const pullWebhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/backup/pull`
      : "/api/backup/pull";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">
        {t("admin.backup.title")}
      </h1>

      {/* ── Card 1: Remote Backup (Push) ── */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-6">
        <div className="flex items-center gap-2">
          <CloudUpload className="h-5 w-5 text-purple-500" />
          <h2 className="text-lg font-medium text-foreground">
            {t("admin.backup.push.title")}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("admin.backup.push.description")}
        </p>

        {editMode ? (
          /* ── Edit / Setup form ── */
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Webhook URL
              </label>
              <Input
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="https://backy.dev.hexly.ai/api/webhook/..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                API Key
              </label>
              <Input
                type="password"
                value={editKey}
                onChange={(e) => setEditKey(e.target.value)}
                placeholder={configured ? t("admin.backup.push.apiKeyUnchanged") : "Bearer token"}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !editUrl || !editKey}>
                {saving ? t("admin.backup.saving") : t("admin.backup.save")}
              </Button>
              {configured && (
                <Button variant="ghost" onClick={cancelEdit}>
                  <X className="h-4 w-4 mr-1" />
                  {t("admin.backup.cancel")}
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* ── Configured view ── */
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

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                <Plug className="h-3.5 w-3.5 mr-1.5" />
                {testing ? t("admin.backup.testing") : t("admin.backup.testConnection")}
              </Button>
              <Button size="sm" onClick={handlePush} disabled={pushing}>
                <CloudUpload className="h-3.5 w-3.5 mr-1.5" />
                {pushing ? t("admin.backup.pushing") : t("admin.backup.pushBackup")}
              </Button>
            </div>

            {/* Status message */}
            {message && <StatusMessage type={message.type} text={message.text} />}

            {/* Push result details */}
            {pushDetail?.request && (
              <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1 font-mono">
                <div>Tag: {pushDetail.request.tag}</div>
                <div>File: {pushDetail.request.fileName}</div>
                <div>
                  Size: {pushDetail.request.fileSizeBytes < 1024
                    ? `${pushDetail.request.fileSizeBytes} B`
                    : `${(pushDetail.request.fileSizeBytes / 1024).toFixed(1)} KB`}
                </div>
                {pushDetail.durationMs && <div>Duration: {pushDetail.durationMs}ms</div>}
                <div className="text-muted-foreground">
                  {Object.entries(pushDetail.request.backupStats)
                    .map(([k, v]) => `${v} ${k}`)
                    .join(" · ")}
                </div>
              </div>
            )}

            {/* History section */}
            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">
                  {t("admin.backup.history.title")}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshHistory}
                  disabled={loadingHistory}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 mr-1", loadingHistory && "animate-spin")} />
                  {t("admin.backup.history.refresh")}
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
                  <p className="text-sm text-muted-foreground">
                    {t("admin.backup.history.empty")}
                  </p>
                )
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("admin.backup.history.hint")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Card 2: Pull Webhook ── */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-6">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-yellow-500" />
          <h2 className="text-lg font-medium text-foreground">
            {t("admin.backup.pull.title")}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("admin.backup.pull.description")}
        </p>

        {pullKey ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Webhook URL
                </label>
                <CopyButton text={pullWebhookUrl} />
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
                <CopyButton text={pullKey} />
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
                onClick={handleGeneratePullKey}
                disabled={pullKeyLoading}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                {t("admin.backup.pull.regenerate")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRevokePullKey}
                disabled={pullKeyLoading}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5 text-red-500" />
                {t("admin.backup.pull.revoke")}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={handleGeneratePullKey}
            disabled={pullKeyLoading}
          >
            <KeyRound className="h-4 w-4 mr-2" />
            {t("admin.backup.pull.generate")}
          </Button>
        )}
      </div>
    </div>
  );
}
