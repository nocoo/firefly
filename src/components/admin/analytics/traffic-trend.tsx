"use client";

import type { AnalyticsDailyTrend } from "@/models/analytics-types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { SOURCE_COLORS, TOOLTIP_STYLE, formatDateShort } from "./chart-helpers";
import { useLocale } from "@/i18n/context";

interface TrafficTrendProps {
  daily: AnalyticsDailyTrend[];
}

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
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={daily}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickFormatter={formatDateShort}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Area
            type="monotone"
            dataKey="human"
            name={t("admin.analytics.humanVisitors")}
            stroke={SOURCE_COLORS.human}
            fill={SOURCE_COLORS.human}
            fillOpacity={0.15}
            strokeWidth={2}
            stackId="1"
          />
          <Area
            type="monotone"
            dataKey="search"
            name={t("admin.analytics.searchEngines")}
            stroke={SOURCE_COLORS.search}
            fill={SOURCE_COLORS.search}
            fillOpacity={0.1}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            stackId="1"
          />
          <Area
            type="monotone"
            dataKey="ai"
            name={t("admin.analytics.aiBots")}
            stroke={SOURCE_COLORS.ai}
            fill={SOURCE_COLORS.ai}
            fillOpacity={0.1}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            stackId="1"
          />
          <Area
            type="monotone"
            dataKey="otherBot"
            name={t("admin.analytics.otherBots")}
            stroke={SOURCE_COLORS.other}
            fill={SOURCE_COLORS.other}
            fillOpacity={0.05}
            strokeWidth={1}
            strokeDasharray="2 2"
            stackId="1"
          />
        </AreaChart>
      </ResponsiveContainer>
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
