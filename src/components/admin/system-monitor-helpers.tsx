"use client";

import { Activity, TrendingUp } from "lucide-react";

// ---------------------------------------------------------------------------
// Types — shared across system monitor components
// ---------------------------------------------------------------------------

export interface MemorySnapshot {
  timestamp: number;
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
  arrayBuffersMB: number;
}

export interface SystemStats {
  memory: {
    current: MemorySnapshot;
    history: MemorySnapshot[];
    summary: {
      peakHeapMB: number;
      avgHeapMB: number;
      sampleCount: number;
      collectionStarted: number | null;
      uptimeSeconds: number;
    };
  };
}

// ---------------------------------------------------------------------------
// Time formatters
// ---------------------------------------------------------------------------

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (mins > 0) return `${mins}分钟前`;
  return "刚刚";
}

// ---------------------------------------------------------------------------
// Chart palette
// ---------------------------------------------------------------------------

export const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))"];

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

export function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  trend,
  index = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext?: string;
  trend?: "up" | "down";
  index?: number;
}) {
  return (
    <div
      className="rounded-widget bg-secondary p-4 animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        {trend && (
          <TrendingUp
            className={`h-4 w-4 ${trend === "up" ? "text-warning" : "text-success rotate-180"}`}
          />
        )}
      </div>
      <div className="mt-2 text-2xl font-semibold font-display text-foreground tabular-nums">
        {value}
      </div>
      {subtext && (
        <div className="mt-1 text-xs text-muted-foreground">{subtext}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Memory recommendation block
// ---------------------------------------------------------------------------

type RecommendationStatus = "healthy" | "warning" | "critical";

function buildRecommendations(memory: SystemStats["memory"]): {
  status: RecommendationStatus;
  messages: string[];
} {
  const heapPercent =
    (memory.current.heapUsedMB / memory.current.heapTotalMB) * 100;
  const rssGB = memory.current.rssMB / 1024;
  const containerLimitGB = 4;

  let status: RecommendationStatus = "healthy";
  const messages: string[] = [];

  if (heapPercent > 85) {
    status = "critical";
    messages.push("堆内存使用率过高（>85%）。建议检查内存泄漏或增加内存限制。");
  } else if (heapPercent > 70) {
    status = "warning";
    messages.push("堆内存使用率偏高（>70%）。请持续关注内存压力。");
  }

  if (rssGB > containerLimitGB * 0.8) {
    status = "critical";
    messages.push(
      `RSS（${rssGB.toFixed(1)}GB）接近容器限制（${containerLimitGB}GB）。存在 OOM 风险。`,
    );
  } else if (rssGB > containerLimitGB * 0.6) {
    if (status !== "critical") status = "warning";
    messages.push(
      `RSS（${rssGB.toFixed(1)}GB）已达容器限制的 ${Math.round((rssGB / containerLimitGB) * 100)}%。`,
    );
  }

  if (messages.length === 0) {
    messages.push("内存使用正常，无需立即处理。");
  }

  return { status, messages };
}

const STATUS_BG: Record<RecommendationStatus, string> = {
  healthy: "bg-green-500/10 border-green-500/30",
  warning: "bg-amber-500/10 border-amber-500/30",
  critical: "bg-red-500/10 border-red-500/30",
};

const STATUS_TEXT: Record<RecommendationStatus, string> = {
  healthy: "text-green-600 dark:text-green-400",
  warning: "text-amber-600 dark:text-amber-400",
  critical: "text-red-600 dark:text-red-400",
};

export function MemoryRecommendation({
  memory,
}: {
  memory: SystemStats["memory"];
}) {
  const { status, messages } = buildRecommendations(memory);

  return (
    <div className={`rounded-widget p-6 ${STATUS_BG[status]}`}>
      <h3
        className={`flex items-center gap-2 text-sm font-medium ${STATUS_TEXT[status]}`}
      >
        <Activity className="h-4 w-4" />
        内存评估
      </h3>
      <ul className="mt-3 space-y-1.5 text-sm">
        {messages.map((rec, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-current shrink-0" />
            {rec}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

export function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-widget bg-secondary p-4">
            <div className="animate-pulse space-y-2">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-8 w-24 rounded bg-muted" />
              <div className="h-3 w-16 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-widget bg-secondary p-6">
        <div className="animate-pulse">
          <div className="h-4 w-32 rounded bg-muted mb-4" />
          <div className="h-64 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
