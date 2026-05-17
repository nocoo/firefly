"use client";

import { Activity } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_COLORS,
  formatDateTime,
  formatTime,
  type MemorySnapshot,
} from "./system-monitor-helpers";

function downsample(data: MemorySnapshot[], maxPoints: number): MemorySnapshot[] {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, i) => i % step === 0 || i === data.length - 1);
}

export function MemoryTrendChart({
  history,
  sampleCount,
}: {
  history: MemorySnapshot[];
  sampleCount: number;
}) {
  const chartData = downsample(history, 144).map((s) => ({
    time: formatTime(s.timestamp),
    fullTime: formatDateTime(s.timestamp),
    heap: s.heapUsedMB,
    heapTotal: s.heapTotalMB,
    rss: s.rssMB,
    external: s.externalMB,
  }));

  return (
    <div className="rounded-widget bg-secondary">
      <div className="border-b border-border/50 px-6 py-4">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Activity className="h-4 w-4" />
          内存使用趋势（48小时）
        </h3>
      </div>
      <div className="p-6">
        {chartData.length > 1 ? (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="heapGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="rssGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS[1]} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
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
                    labelFormatter={(_, payload) =>
                      payload[0]?.payload?.fullTime ?? ""
                    }
                    formatter={(value, name) => [
                      `${value} MB`,
                      name === "heap" ? "堆内存" : "RSS（总内存）",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="rss"
                    stroke={CHART_COLORS[1]}
                    fill="url(#rssGradient)"
                    strokeWidth={1.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="heap"
                    stroke={CHART_COLORS[0]}
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
                  style={{ backgroundColor: CHART_COLORS[0] }}
                />
                堆内存
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: CHART_COLORS[1] }}
                />
                RSS（总内存）
              </span>
            </div>
          </>
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            {`已采集 ${sampleCount} 个样本`}
          </div>
        )}
      </div>
    </div>
  );
}
