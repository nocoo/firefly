"use client";

import type { AnalyticsDailyTrend } from "@/models/analytics-types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  SOURCE_COLORS,
  chartAxis,
  formatDateLabel,
  formatNumber,
  CHART_MARGIN,
} from "./chart-helpers";
import { DashboardResponsiveContainer } from "./responsive-container";
import { useLocale } from "@/i18n/context";

interface TrafficTrendProps {
  daily: AnalyticsDailyTrend[];
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function TrafficTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string; name: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum, e) => sum + e.value, 0);

  return (
    <div className="rounded-[var(--radius-widget)] border border-border bg-popover p-2.5 shadow-sm">
      <p className="mb-1 text-xs font-medium text-foreground">
        {label ? formatDateLabel(label) : ""}
      </p>
      <div className="mb-1 border-b border-border/50 pb-1 flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Total</span>
        <span className="ml-auto font-medium text-foreground">
          {formatNumber(total)}
        </span>
      </div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="ml-auto font-medium text-foreground">
            {formatNumber(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend items for inline legend above chart
// ---------------------------------------------------------------------------

const LEGEND_ITEMS: { key: string; label: string; color: string }[] = [
  { key: "human", label: "Human", color: SOURCE_COLORS.human },
  { key: "search", label: "Search", color: SOURCE_COLORS.search },
  { key: "ai", label: "AI", color: SOURCE_COLORS.ai },
  { key: "otherBot", label: "Other", color: SOURCE_COLORS.other },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TrafficTrend({ daily }: TrafficTrendProps) {
  const { t } = useLocale();

  if (daily.length === 0) {
    return (
      <DataCard title={t("admin.analytics.trafficOverTime")}>
        <p className="text-sm text-muted-foreground py-4">
          {t("admin.analytics.noData")}
        </p>
      </DataCard>
    );
  }

  return (
    <DataCard title={t("admin.analytics.trafficOverTime")}>
      {/* Inline legend */}
      <div className="mb-3 flex items-center gap-4">
        {LEGEND_ITEMS.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-full"
              style={{ background: color }}
            />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      <div className="h-[260px] md:h-[300px]">
        <DashboardResponsiveContainer width="100%" height="100%">
          <AreaChart data={daily} margin={CHART_MARGIN}>
            <defs>
              <linearGradient id="gradHuman" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SOURCE_COLORS.human} stopOpacity={0.3} />
                <stop offset="100%" stopColor={SOURCE_COLORS.human} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradSearch" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SOURCE_COLORS.search} stopOpacity={0.3} />
                <stop offset="100%" stopColor={SOURCE_COLORS.search} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradAi" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SOURCE_COLORS.ai} stopOpacity={0.3} />
                <stop offset="100%" stopColor={SOURCE_COLORS.ai} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradOther" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SOURCE_COLORS.other} stopOpacity={0.3} />
                <stop offset="100%" stopColor={SOURCE_COLORS.other} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={chartAxis}
              strokeOpacity={0.15}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={{ fill: chartAxis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: chartAxis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              content={<TrafficTooltip />}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="human"
              name={t("admin.analytics.humanVisitors")}
              stroke={SOURCE_COLORS.human}
              strokeWidth={2}
              fill="url(#gradHuman)"
              stackId="1"
            />
            <Area
              type="monotone"
              dataKey="search"
              name={t("admin.analytics.searchEngines")}
              stroke={SOURCE_COLORS.search}
              strokeWidth={2}
              fill="url(#gradSearch)"
              stackId="1"
            />
            <Area
              type="monotone"
              dataKey="ai"
              name={t("admin.analytics.aiBots")}
              stroke={SOURCE_COLORS.ai}
              strokeWidth={2}
              fill="url(#gradAi)"
              stackId="1"
            />
            <Area
              type="monotone"
              dataKey="otherBot"
              name={t("admin.analytics.otherBots")}
              stroke={SOURCE_COLORS.other}
              strokeWidth={2}
              fill="url(#gradOther)"
              stackId="1"
            />
          </AreaChart>
        </DashboardResponsiveContainer>
      </div>
    </DataCard>
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
