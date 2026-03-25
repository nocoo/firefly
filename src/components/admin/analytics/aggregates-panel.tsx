"use client";

import type { AnalyticsAggregates } from "@/models/analytics-types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  CHART_COLORS,
  chartAxis,
  formatNumber,
  H_BAR_MARGIN,
} from "./chart-helpers";
import { DashboardResponsiveContainer } from "./responsive-container";
import { useLocale } from "@/i18n/context";

interface AggregatesPanelProps {
  aggregates: AnalyticsAggregates;
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function BarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string; payload?: { name: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0] as (typeof payload)[number];
  const name = entry.payload?.name ?? "";

  return (
    <div className="rounded-[var(--radius-widget)] border border-border bg-card p-2.5 shadow-sm">
      <div className="flex items-center gap-2 text-xs">
        <div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: entry.color }}
        />
        <span className="text-muted-foreground">{name}</span>
        <span className="ml-auto font-medium text-foreground">
          {formatNumber(entry.value)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AggregatesPanel({ aggregates }: AggregatesPanelProps) {
  const { t } = useLocale();

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title={t("admin.analytics.countries")}>
        {aggregates.countries.length === 0 ? (
          <NoData text={t("admin.analytics.noData")} />
        ) : (
          <HorizontalBar
            data={aggregates.countries.map((c) => ({
              name: c.country,
              value: c.count,
            }))}
            color={CHART_COLORS[0]}
          />
        )}
      </Panel>

      <Panel title={t("admin.analytics.platforms")}>
        {aggregates.platforms.length === 0 ? (
          <NoData text={t("admin.analytics.noData")} />
        ) : (
          <HorizontalBar
            data={aggregates.platforms.map((p) => ({
              name: p.os,
              value: p.count,
            }))}
            color={CHART_COLORS[2]}
          />
        )}
      </Panel>

      <Panel title={t("admin.analytics.browsers")}>
        {aggregates.browsers.length === 0 ? (
          <NoData text={t("admin.analytics.noData")} />
        ) : (
          <HorizontalBar
            data={aggregates.browsers.map((b) => ({
              name: b.browser,
              value: b.count,
            }))}
            color={CHART_COLORS[1]}
          />
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Panel({
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

function NoData({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-4">{text}</p>;
}

function HorizontalBar({
  data,
  color,
}: {
  data: { name: string; value: number }[];
  color: string;
}) {
  const barHeight = 28;
  const chartHeight = Math.max(data.length * barHeight + 40, 100);

  return (
    <div style={{ height: chartHeight }}>
      <DashboardResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={H_BAR_MARGIN}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={chartAxis}
            strokeOpacity={0.15}
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fill: chartAxis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: chartAxis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<BarTooltip />} isAnimationActive={false} />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </DashboardResponsiveContainer>
    </div>
  );
}
