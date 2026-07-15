"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BackyBackupEntry } from "@/models/backup";
import { formatFileSize, formatTimeAgo } from "@/models/backup";

export function StatusMessage({
  type,
  text,
}: {
  type: "success" | "error" | "info";
  text: string;
}) {
  return (
    <p
      className={cn(
        "text-sm",
        type === "success" && "text-success",
        type === "error" && "text-destructive",
        type === "info" && "text-muted-foreground",
      )}
    >
      {text}
    </p>
  );
}

export function BackupCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export function HistoryRow({ entry }: { entry: BackyBackupEntry }) {
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
