"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, HardDrive, Cpu, Clock } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MemorySnapshot {
  timestamp: number;
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
  arrayBuffersMB: number;
}

interface MemoryStats {
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
// Helpers
// ---------------------------------------------------------------------------

function formatMemoryMB(mb: number): { value: string; unit: string } {
  if (mb >= 1024) {
    const gb = mb / 1024;
    return {
      value: (Math.round(gb * 10) / 10).toString(),
      unit: "GB",
    };
  }
  return {
    value: Math.round(mb).toString(),
    unit: "MB",
  };
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SystemMemoryCard() {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/system/memory");
      if (!res.ok) {
        if (res.status === 401) {
          setError("Unauthorized");
          return;
        }
        throw new Error("Failed to fetch");
      }
      const data: MemoryStats = await res.json();
      setStats(data);
      setError(null);
    } catch {
      setError("Failed to load memory stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="rounded-widget bg-secondary p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-32 rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-widget bg-secondary p-6">
        <p className="text-sm text-muted-foreground">{error ?? "No data"}</p>
      </div>
    );
  }

  const { current, history, summary } = stats.memory;

  // Downsample history for chart display (max 96 points = 48h at 30min intervals)
  // This keeps the chart readable while showing the full 48h trend
  const downsampleForChart = (data: MemorySnapshot[], maxPoints: number) => {
    if (data.length <= maxPoints) return data;
    const step = Math.ceil(data.length / maxPoints);
    return data.filter((_, i) => i % step === 0 || i === data.length - 1);
  };

  const chartData = downsampleForChart(history, 96).map((s) => ({
    time: formatTime(s.timestamp),
    heap: s.heapUsedMB,
    rss: s.rssMB,
  }));

  // Calculate heap usage percentage
  const heapPercent = current.heapTotalMB > 0
    ? Math.round((current.heapUsedMB / current.heapTotalMB) * 100)
    : 0;

  return (
    <div className="rounded-widget bg-secondary">
      {/* Header */}
      <div className="border-b border-border/50 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Activity className="h-4 w-4" />
          系统内存
        </h3>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        {/* 1. Heap Used */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
            <HardDrive className="h-3 w-3 shrink-0" />
            <span>堆内存</span>
          </div>
          {(() => {
            const { value, unit } = formatMemoryMB(current.heapUsedMB);
            return (
              <div className="text-xl sm:text-2xl font-semibold tabular-nums">
                {value}
                <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1">
                  {unit}
                </span>
              </div>
            );
          })()}
          <div className="text-[11px] sm:text-xs text-muted-foreground truncate">
            {heapPercent}%
            <span className="hidden sm:inline"> of {formatMemoryMB(current.heapTotalMB).value} {formatMemoryMB(current.heapTotalMB).unit}</span>
          </div>
        </div>

        {/* 2. RSS */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
            <Cpu className="h-3 w-3 shrink-0" />
            <span>RSS</span>
          </div>
          {(() => {
            const { value, unit } = formatMemoryMB(current.rssMB);
            return (
              <div className="text-xl sm:text-2xl font-semibold tabular-nums">
                {value}
                <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1">
                  {unit}
                </span>
              </div>
            );
          })()}
          <div className="text-[11px] sm:text-xs text-muted-foreground truncate">
            进程总内存
          </div>
        </div>

        {/* 3. Peak / Avg (hide subtext on small screens) */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
            <Activity className="h-3 w-3 shrink-0" />
            <span>峰值</span>
          </div>
          {(() => {
            const { value, unit } = formatMemoryMB(summary.peakHeapMB);
            return (
              <div className="text-xl sm:text-2xl font-semibold tabular-nums">
                {value}
                <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1">
                  {unit}
                </span>
              </div>
            );
          })()}
          <div className="text-[11px] sm:text-xs text-muted-foreground truncate">
            <span className="hidden sm:inline">平均：</span>
            {formatMemoryMB(summary.avgHeapMB).value} {formatMemoryMB(summary.avgHeapMB).unit}
          </div>
        </div>

        {/* 4. Uptime */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
            <Clock className="h-3 w-3 shrink-0" />
            <span>运行时间</span>
          </div>
          <div className="text-xl sm:text-2xl font-semibold tabular-nums truncate">
            {formatUptime(summary.uptimeSeconds)}
          </div>
          <div className="text-[11px] sm:text-xs text-muted-foreground truncate">
            {summary.sampleCount} 个样本
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="border-t border-border/50 px-4 py-3">
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                  formatter={(value, name) => [
                    `${value} MB`,
                    name === "heap" ? "Heap" : "RSS",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="heap"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="rss"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="4 2"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-4 rounded bg-[hsl(var(--chart-1))]" />
              Heap Used
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-4 rounded bg-[hsl(var(--chart-2))] opacity-60" />
              RSS (Total)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
