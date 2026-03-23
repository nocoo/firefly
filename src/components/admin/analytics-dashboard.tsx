"use client";

import { useEffect, useState, useCallback } from "react";
import { useLocale } from "@/i18n/context";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ---------------------------------------------------------------------------
// Types matching the API response
// ---------------------------------------------------------------------------

interface OverviewStats {
  totalViews: number;
  totalUniqueVisitors: number;
  totalBotViews: number;
  totalAiBotViews: number;
  totalSearchBotViews: number;
}

interface DailyStat {
  date: string;
  total_views: number;
  unique_visitors: number;
  total_bot_views: number;
  ai_bot_views: number;
  search_bot_views: number;
}

interface TopPost {
  postId: string;
  title: string;
  slug: string;
  views: number;
}

interface TopReferrer {
  referrer: string;
  views: number;
}

interface DeviceBreakdown {
  deviceType: string;
  count: number;
}

interface BotBreakdown {
  botName: string;
  botCategory: string;
  count: number;
}

interface BrowserBreakdown {
  browser: string;
  count: number;
}

interface AnalyticsData {
  overview: OverviewStats;
  dailyStats: DailyStat[];
  topPosts: TopPost[];
  recentViews: number;
  topReferrers: TopReferrer[];
  devices: DeviceBreakdown[];
  browsers: BrowserBreakdown[];
  bots: BotBreakdown[];
  period: { days: number };
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
  "hsl(var(--chart-8))",
];

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const BOT_CATEGORY_COLORS: Record<string, string> = {
  search: "hsl(var(--chart-1))",
  ai: "hsl(var(--chart-5))",
  social: "hsl(var(--chart-6))",
  monitor: "hsl(var(--chart-7))",
  other: "hsl(var(--chart-8))",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const { t } = useLocale();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics?days=${days}`);
      if (!res.ok) throw new Error(t("admin.analytics.fetchError"));
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.analytics.fetchError"));
    } finally {
      setLoading(false);
    }
  }, [days, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <AnalyticsSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-destructive">
        {t("admin.analytics.fetchError")}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t("admin.analytics.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("admin.analytics.recentViews", { n: data.recentViews })}
          </p>
        </div>
        <SegmentedControl
          options={[7, 30, 90].map((d) => ({ value: d, label: `${d}d` }))}
          value={days}
          onChange={setDays}
        />
      </div>

      {/* Overview cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("admin.analytics.totalViews")}
          value={data.overview.totalViews}
        />
        <StatCard
          label={t("admin.analytics.uniqueVisitors")}
          value={data.overview.totalUniqueVisitors}
        />
        <StatCard
          label={t("admin.analytics.botViews")}
          value={data.overview.totalBotViews}
          sublabel={t("admin.analytics.botSublabel", { ai: data.overview.totalAiBotViews, search: data.overview.totalSearchBotViews })}
        />
        <StatCard
          label={t("admin.analytics.recent24h")}
          value={data.recentViews}
        />
      </div>

      {/* Traffic chart */}
      {data.dailyStats.length > 0 && (
        <DataCard title={t("admin.analytics.trafficOverTime")}>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickFormatter={(v: string) => v.slice(5)} // MM-DD
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="total_views"
                name={t("admin.analytics.chartViews")}
                stroke={CHART_COLORS[0]}
                fill={CHART_COLORS[0]}
                fillOpacity={0.1}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="unique_visitors"
                name={t("admin.analytics.chartUnique")}
                stroke={CHART_COLORS[2]}
                fill={CHART_COLORS[2]}
                fillOpacity={0.1}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="total_bot_views"
                name={t("admin.analytics.chartBots")}
                stroke={CHART_COLORS[3]}
                fill={CHART_COLORS[3]}
                fillOpacity={0.05}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            </AreaChart>
          </ResponsiveContainer>
        </DataCard>
      )}

      {/* Two-column: Top posts + Referrers */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top posts */}
        <DataCard title={t("admin.analytics.topPosts")}>
          {data.topPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t("admin.analytics.noData")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">{t("admin.analytics.tablePost")}</th>
                  <th className="pb-2 font-medium text-right">{t("admin.analytics.tableViews")}</th>
                </tr>
              </thead>
              <tbody>
                {data.topPosts.map((post) => (
                  <tr
                    key={post.postId}
                    className="border-t border-border/50"
                  >
                    <td className="py-2 pr-4 truncate max-w-[200px]">
                      {post.title}
                    </td>
                    <td className="py-2 text-right tabular-nums font-medium">
                      {post.views.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataCard>

        {/* Referrers */}
        <DataCard title={t("admin.analytics.topReferrers")}>
          {data.topReferrers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t("admin.analytics.noData")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">{t("admin.analytics.tableReferrer")}</th>
                  <th className="pb-2 font-medium text-right">{t("admin.analytics.tableViews")}</th>
                </tr>
              </thead>
              <tbody>
                {data.topReferrers.map((ref, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="py-2 pr-4 truncate max-w-[200px]">
                      {formatReferrer(ref.referrer)}
                    </td>
                    <td className="py-2 text-right tabular-nums font-medium">
                      {ref.views.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataCard>
      </div>

      {/* Three-column: Devices, Browsers, Bots */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Devices */}
        <DataCard title={t("admin.analytics.devices")}>
          {data.devices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t("admin.analytics.noData")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data.devices}
                  dataKey="count"
                  nameKey="deviceType"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={40}
                  paddingAngle={2}
                  label={({
                    name,
                    percent,
                  }: {
                    name?: string | number;
                    percent?: number;
                  }) =>
                    `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {data.devices.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </DataCard>

        {/* Browsers */}
        <DataCard title={t("admin.analytics.browsers")}>
          {data.browsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t("admin.analytics.noData")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={data.browsers}
                layout="vertical"
                margin={{ left: 60 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                <YAxis
                  type="category"
                  dataKey="browser"
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </DataCard>

        {/* Bot traffic */}
        <DataCard title={t("admin.analytics.botTraffic")}>
          {data.bots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t("admin.analytics.noData")}</p>
          ) : (
            <div className="space-y-2 text-sm">
              {data.bots.map((bot, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor:
                          BOT_CATEGORY_COLORS[bot.botCategory] ?? "#6b7280",
                      }}
                    />
                    <span className="truncate max-w-[120px]">
                      {bot.botName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {bot.botCategory}
                    </span>
                  </div>
                  <span className="tabular-nums font-medium">
                    {bot.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DataCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: number;
  sublabel?: string;
}) {
  return (
    <div className="rounded-[var(--radius-widget)] bg-secondary p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
        {value.toLocaleString()}
      </p>
      {sublabel && (
        <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>
      )}
    </div>
  );
}

function DataCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-widget)] border border-border/50 bg-secondary/50 p-4">
      <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[var(--radius-sm)] bg-muted ${className ?? ""}`}
    />
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonPulse className="h-6 w-32" />
          <SkeletonPulse className="h-4 w-48" />
        </div>
        <SkeletonPulse className="h-8 w-[120px]" />
      </div>
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[var(--radius-widget)] bg-secondary p-4 space-y-2">
            <SkeletonPulse className="h-4 w-20" />
            <SkeletonPulse className="h-7 w-16" />
            <SkeletonPulse className="h-3 w-24" />
          </div>
        ))}
      </div>
      {/* Chart placeholder */}
      <div className="rounded-[var(--radius-widget)] border border-border/50 bg-secondary/50 p-4 space-y-3">
        <SkeletonPulse className="h-4 w-36" />
        <SkeletonPulse className="h-[200px] w-full" />
      </div>
      {/* Table placeholders */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-[var(--radius-widget)] border border-border/50 bg-secondary/50 p-4 space-y-3">
            <SkeletonPulse className="h-4 w-28" />
            {Array.from({ length: 5 }).map((_, j) => (
              <SkeletonPulse key={j} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatReferrer(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace("www.", "");
  } catch {
    return url;
  }
}
