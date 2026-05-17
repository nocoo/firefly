"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Cpu, HardDrive, RefreshCw, TrendingUp } from "lucide-react";
import { useSetPageSubtitle } from "@/components/admin/page-subtitle-context";
import { MemoryTrendChart } from "./system-monitor-chart";
import {
  formatTimeAgo,
  formatUptime,
  LoadingSkeleton,
  MemoryRecommendation,
  StatCard,
  type SystemStats,
} from "./system-monitor-helpers";

export function SystemMonitorDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useSetPageSubtitle("系统监控");

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
      const data: SystemStats = await res.json();
      setStats(data);
      setLastUpdated(Date.now());
      setError(null);
    } catch {
      setError("Failed to load system stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Refresh every 10 seconds
    const interval = setInterval(fetchStats, 10_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) return <LoadingSkeleton />;

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        {error ?? "No data available"}
      </div>
    );
  }

  const { memory } = stats;
  const heapPct = Math.round(
    (memory.current.heapUsedMB / memory.current.heapTotalMB) * 100,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {lastUpdated && `上次更新：${formatTimeAgo(lastUpdated)}`}
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          刷新
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={HardDrive}
          label="堆内存使用"
          value={`${memory.current.heapUsedMB} MB`}
          subtext={`占比 ${heapPct}%，共 ${memory.current.heapTotalMB} MB`}
          trend={
            memory.current.heapUsedMB > memory.summary.avgHeapMB ? "up" : "down"
          }
          index={0}
        />
        <StatCard
          icon={Cpu}
          label="RSS（总内存）"
          value={`${memory.current.rssMB} MB`}
          subtext="进程总内存"
          index={1}
        />
        <StatCard
          icon={TrendingUp}
          label="峰值 / 平均"
          value={`${memory.summary.peakHeapMB} MB`}
          subtext={`平均：${memory.summary.avgHeapMB} MB`}
          index={2}
        />
        <StatCard
          icon={Clock}
          label="运行时间"
          value={formatUptime(memory.summary.uptimeSeconds)}
          subtext={`已采集 ${memory.summary.sampleCount} 个样本`}
          index={3}
        />
      </div>

      <MemoryTrendChart
        history={memory.history}
        sampleCount={memory.summary.sampleCount}
      />

      <MemoryRecommendation memory={memory} />
    </div>
  );
}
