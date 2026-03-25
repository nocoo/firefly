"use client";

import type { AnalyticsAggregates } from "@/models/analytics-types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE } from "./chart-helpers";
import { useLocale } from "@/i18n/context";

interface AggregatesPanelProps {
  aggregates: AnalyticsAggregates;
}

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
  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * 28, 100)}>
      <BarChart data={data} layout="vertical" margin={{ left: 60 }}>
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          width={55}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
