"use client";

import { useEffect, useState, useCallback } from "react";
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
  "var(--color-primary)",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const BOT_CATEGORY_COLORS: Record<string, string> = {
  search: "#3b82f6",
  ai: "#8b5cf6",
  social: "#ec4899",
  monitor: "#06b6d4",
  other: "#6b7280",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics?days=${days}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-destructive">
        {error}
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
            Site Analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            {data.recentViews} views in the last 24 hours
          </p>
        </div>
        <div className="flex rounded-[var(--radius-widget)] border border-border bg-secondary p-0.5">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-[calc(var(--radius-widget)-2px)] px-3 py-1 text-xs font-medium transition-colors ${
                days === d
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Views"
          value={data.overview.totalViews}
        />
        <StatCard
          label="Unique Visitors"
          value={data.overview.totalUniqueVisitors}
        />
        <StatCard
          label="Bot Views"
          value={data.overview.totalBotViews}
          sublabel={`AI: ${data.overview.totalAiBotViews} · Search: ${data.overview.totalSearchBotViews}`}
        />
        <StatCard
          label="Recent (24h)"
          value={data.recentViews}
        />
      </div>

      {/* Traffic chart */}
      {data.dailyStats.length > 0 && (
        <ChartCard title="Traffic Over Time">
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
                name="Views"
                stroke={CHART_COLORS[0]}
                fill={CHART_COLORS[0]}
                fillOpacity={0.1}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="unique_visitors"
                name="Unique"
                stroke={CHART_COLORS[2]}
                fill={CHART_COLORS[2]}
                fillOpacity={0.1}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="total_bot_views"
                name="Bots"
                stroke={CHART_COLORS[3]}
                fill={CHART_COLORS[3]}
                fillOpacity={0.05}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Two-column: Top posts + Referrers */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top posts */}
        <TableCard title="Top Posts">
          {data.topPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No data yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Post</th>
                  <th className="pb-2 font-medium text-right">Views</th>
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
        </TableCard>

        {/* Referrers */}
        <TableCard title="Top Referrers">
          {data.topReferrers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No data yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Referrer</th>
                  <th className="pb-2 font-medium text-right">Views</th>
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
        </TableCard>
      </div>

      {/* Three-column: Devices, Browsers, Bots */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Devices */}
        <ChartCard title="Devices">
          {data.devices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No data yet</p>
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
                  label={({ deviceType, percent }) =>
                    `${deviceType} ${(percent * 100).toFixed(0)}%`
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
        </ChartCard>

        {/* Browsers */}
        <ChartCard title="Browsers">
          {data.browsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No data yet</p>
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
        </ChartCard>

        {/* Bot traffic */}
        <ChartCard title="Bot Traffic">
          {data.bots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No data yet</p>
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
        </ChartCard>
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

function ChartCard({
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

function TableCard({
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
