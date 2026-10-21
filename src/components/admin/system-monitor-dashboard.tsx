"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Cpu, HardDrive, RefreshCw, TrendingUp } from "lucide-react";
import { AdminPageHeader } from "./page-header";
import { AdminSystemMonitorBodySkeleton } from "./loading-skeleton";
import { Button } from "@nocoo/basalt/components/button";
import { MemoryTrendChart } from "./system-monitor-chart";
import {
  formatTimeAgo,
  formatUptime,
  MemoryRecommendation,
  StatCard,
  type SystemStats,
} from "./system-monitor-helpers";

export function SystemMonitorDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

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

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="系统监控"
          description="查看服务内存占用、历史趋势与运行状态。"
          backHref="/admin"
          backLabel="返回管理"
        />
        <AdminSystemMonitorBodySkeleton />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="系统监控"
          description="查看服务内存占用、历史趋势与运行状态。"
          backHref="/admin"
          backLabel="返回管理"
        />
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          {error ?? "No data available"}
        </div>
      </div>
    );
  }

  const { memory } = stats;
  const heapPct = Math.round(
    (memory.current.heapUsedMB / memory.current.heapTotalMB) * 100,
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="系统监控"
        description={`查看服务内存占用、历史趋势与运行状态。${lastUpdated ? ` 上次更新：${formatTimeAgo(lastUpdated)}` : ""}`}
        backHref="/admin"
        backLabel="返回管理"
        actions={
          <Button variant="outline" size="sm" icon={<RefreshCw />} onClick={fetchStats}>
            刷新
          </Button>
        }
      />

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
