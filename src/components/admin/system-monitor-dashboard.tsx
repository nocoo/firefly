"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  HardDrive,
  Cpu,
  Clock,
  Database,
  Layers,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { useSetPageSubtitle } from "@/components/admin/page-subtitle-context";

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

interface CacheEntryMeta {
  key: string;
  kind: string;
  size: number;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  tags: string[];
  revalidate: number | null;
}

interface CacheStats {
  totalEntries: number;
  totalSizeBytes: number;
  entriesByKind: Record<string, number>;
  sizeByKind: Record<string, number>;
  entries: CacheEntryMeta[];
  oldestEntry: number | null;
  newestEntry: number | null;
}

interface SystemStats {
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
  cache: CacheStats;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Chart colors
const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SystemMonitorDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useSetPageSubtitle("性能与缓存监控");

  const formatTimeAgo = useCallback(
    (timestamp: number): string => {
      const diff = Date.now() - timestamp;
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      if (days > 0) return `${days}天前`;
      if (hours > 0) return `${hours}小时前`;
      if (mins > 0) return `${mins}分钟前`;
      return "刚刚";
    },
    [],
  );

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
    return <LoadingSkeleton />;
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        {error ?? "No data available"}
      </div>
    );
  }

  const { memory, cache } = stats;

  // Prepare memory chart data (downsample for readability)
  const downsample = (data: MemorySnapshot[], maxPoints: number) => {
    if (data.length <= maxPoints) return data;
    const step = Math.ceil(data.length / maxPoints);
    return data.filter((_, i) => i % step === 0 || i === data.length - 1);
  };

  const memoryChartData = downsample(memory.history, 144).map((s) => ({
    time: formatTime(s.timestamp),
    fullTime: formatDateTime(s.timestamp),
    heap: s.heapUsedMB,
    heapTotal: s.heapTotalMB,
    rss: s.rssMB,
    external: s.externalMB,
  }));

  // Cache kind distribution for pie chart
  const cacheKindData = Object.entries(cache.entriesByKind).map(([kind, count]) => ({
    name: kind,
    value: count,
  }));

  // Cache size by kind for bar chart
  const cacheSizeData = Object.entries(cache.sizeByKind)
    .map(([kind, size]) => ({
      kind,
      sizeMB: size / 1024 / 1024,
      sizeLabel: formatBytes(size),
    }))
    .sort((a, b) => b.sizeMB - a.sizeMB);

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
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

      {/* Memory Overview Cards */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={HardDrive}
          label="堆内存使用"
          value={`${memory.current.heapUsedMB} MB`}
          subtext={`占比 ${Math.round((memory.current.heapUsedMB / memory.current.heapTotalMB) * 100)}%，共 ${memory.current.heapTotalMB} MB`}
          trend={memory.current.heapUsedMB > memory.summary.avgHeapMB ? "up" : "down"}
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

      {/* Memory Trend Chart */}
      <div className="rounded-[var(--radius-widget)] bg-secondary">
        <div className="border-b border-border/50 px-6 py-4">
          <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Activity className="h-4 w-4" />
            内存使用趋势（48小时）
          </h3>
        </div>
        <div className="p-6">
          {memoryChartData.length > 1 ? (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={memoryChartData}>
                    <defs>
                      <linearGradient id="heapGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="rssGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS[1]} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={COLORS[1]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
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
                      width={50}
                      tickFormatter={(v) => `${v} MB`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                      labelFormatter={(_, payload) => payload[0]?.payload?.fullTime ?? ""}
                      formatter={(value, name) => [
                        `${value} MB`,
                        name === "heap" ? "堆内存" : "RSS（总内存）",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="rss"
                      stroke={COLORS[1]}
                      fill="url(#rssGradient)"
                      strokeWidth={1.5}
                    />
                    <Area
                      type="monotone"
                      dataKey="heap"
                      stroke={COLORS[0]}
                      fill="url(#heapGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex justify-center gap-6 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLORS[0] }}
                  />
                  堆内存
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLORS[1] }}
                  />
                  RSS（总内存）
                </span>
              </div>
            </>
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              {`已采集 ${memory.summary.sampleCount} 个样本`}
            </div>
          )}
        </div>
      </div>

      {/* Cache Statistics */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cache Overview */}
        <div className="rounded-[var(--radius-widget)] bg-secondary">
          <div className="border-b border-border/50 px-6 py-4">
            <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Database className="h-4 w-4" />
              Next.js 缓存概览
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">缓存条目数</div>
                <div className="text-2xl font-semibold tabular-nums">
                  {cache.totalEntries}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">缓存总大小</div>
                <div className="text-2xl font-semibold tabular-nums">
                  {formatBytes(cache.totalSizeBytes)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">最早条目</div>
                <div className="text-sm">
                  {cache.oldestEntry ? formatTimeAgo(cache.oldestEntry) : "—"}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">最新条目</div>
                <div className="text-sm">
                  {cache.newestEntry ? formatTimeAgo(cache.newestEntry) : "—"}
                </div>
              </div>
            </div>

            {/* Kind distribution pie chart */}
            {cacheKindData.length > 0 && (
              <div className="mt-6">
                <div className="text-xs text-muted-foreground mb-2">
                  按类型分布
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={cacheKindData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                        }
                        labelLine={false}
                      >
                        {cacheKindData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cache Size by Kind */}
        <div className="rounded-[var(--radius-widget)] bg-secondary">
          <div className="border-b border-border/50 px-6 py-4">
            <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Layers className="h-4 w-4" />
              缓存大小分布
            </h3>
          </div>
          <div className="p-6">
            {cacheSizeData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cacheSizeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v.toFixed(1)} MB`}
                    />
                    <YAxis
                      type="category"
                      dataKey="kind"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                      formatter={(_, __, props) => [
                        props.payload.sizeLabel,
                        "大小",
                      ]}
                    />
                    <Bar dataKey="sizeMB" radius={[0, 4, 4, 0]}>
                      {cacheSizeData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                暂无缓存条目
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Cache Entries Table */}
      {cache.entries.length > 0 && (
        <div className="rounded-[var(--radius-widget)] bg-secondary">
          <div className="border-b border-border/50 px-6 py-4">
            <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Database className="h-4 w-4" />
              缓存条目排行（按大小）
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-6 py-3 text-left font-medium">键</th>
                  <th className="px-4 py-3 text-left font-medium">类型</th>
                  <th className="px-4 py-3 text-right font-medium">大小</th>
                  <th className="px-4 py-3 text-right font-medium">访问次数</th>
                  <th className="px-4 py-3 text-right font-medium">最后访问</th>
                  <th className="px-4 py-3 text-left font-medium">标签</th>
                </tr>
              </thead>
              <tbody>
                {cache.entries.slice(0, 20).map((entry, i) => (
                  <tr key={entry.key} className={i % 2 === 0 ? "" : "bg-muted/30"}>
                    <td className="px-6 py-2 font-mono text-xs truncate max-w-[300px]">
                      {entry.key}
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                        {entry.kind}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatBytes(entry.size)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {entry.accessCount}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {formatTimeAgo(entry.lastAccessedAt)}
                    </td>
                    <td className="px-4 py-2">
                      {entry.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {entry.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-muted px-1.5 py-0.5 text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                          {entry.tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{entry.tags.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Memory Recommendation */}
      <MemoryRecommendation memory={memory} cache={cache} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
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
      className="rounded-[var(--radius-widget)] bg-secondary p-4 animate-fade-up"
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

function MemoryRecommendation({
  memory,
  cache,
}: {
  memory: SystemStats["memory"];
  cache: CacheStats;
}) {
  const heapPercent = (memory.current.heapUsedMB / memory.current.heapTotalMB) * 100;
  const rssGB = memory.current.rssMB / 1024;
  const cacheGB = cache.totalSizeBytes / 1024 / 1024 / 1024;

  let status: "healthy" | "warning" | "critical" = "healthy";
  const recommendations: string[] = [];

  // Check heap usage
  if (heapPercent > 85) {
    status = "critical";
    recommendations.push("堆内存使用率过高（>85%）。建议减少缓存或增加内存限制。");
  } else if (heapPercent > 70) {
    status = "warning";
    recommendations.push("堆内存使用率偏高（>70%）。请持续关注内存压力。");
  }

  // Check RSS vs container limit (assume 4GB based on Railway config)
  const containerLimitGB = 4;
  if (rssGB > containerLimitGB * 0.8) {
    status = "critical";
    recommendations.push(
      `RSS（${rssGB.toFixed(1)}GB）接近容器限制（${containerLimitGB}GB）。存在 OOM 风险。`,
    );
  } else if (rssGB > containerLimitGB * 0.6) {
    if (status !== "critical") status = "warning";
    recommendations.push(
      `RSS（${rssGB.toFixed(1)}GB）已达容器限制的 ${Math.round((rssGB / containerLimitGB) * 100)}%。`,
    );
  }

  // Check cache size
  if (cacheGB > 0.5) {
    recommendations.push(
      `缓存占用 ${formatBytes(cache.totalSizeBytes)}。可考虑在 next.config.js 中设置 cacheMaxMemorySize。`,
    );
  }

  // Healthy status
  if (recommendations.length === 0) {
    recommendations.push("内存使用正常，无需立即处理。");
  }

  const bgColor = {
    healthy: "bg-green-500/10 border-green-500/30",
    warning: "bg-amber-500/10 border-amber-500/30",
    critical: "bg-red-500/10 border-red-500/30",
  }[status];

  const textColor = {
    healthy: "text-green-600 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
    critical: "text-red-600 dark:text-red-400",
  }[status];

  return (
    <div className={`rounded-[var(--radius-widget)] p-6 ${bgColor}`}>
      <h3 className={`flex items-center gap-2 text-sm font-medium ${textColor}`}>
        <Activity className="h-4 w-4" />
        内存评估
      </h3>
      <ul className="mt-3 space-y-1.5 text-sm">
        {recommendations.map((rec, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-current shrink-0" />
            {rec}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[var(--radius-widget)] bg-secondary p-4">
            <div className="animate-pulse space-y-2">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-8 w-24 rounded bg-muted" />
              <div className="h-3 w-16 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-[var(--radius-widget)] bg-secondary p-6">
        <div className="animate-pulse">
          <div className="h-4 w-32 rounded bg-muted mb-4" />
          <div className="h-64 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
