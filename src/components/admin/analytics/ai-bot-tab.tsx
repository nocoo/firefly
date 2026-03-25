"use client";

import type { AiBotDetailResponse } from "@/models/analytics-types";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import {
  CHART_COLORS,
  TOOLTIP_STYLE,
  formatDateShort,
  formatNumber,
} from "./chart-helpers";
import { useLocale } from "@/i18n/context";

interface AiBotTabProps {
  data: AiBotDetailResponse;
}

export function AiBotTab({ data }: AiBotTabProps) {
  const { t } = useLocale();

  // Group dailyByBot into per-date rows for multi-line chart
  const botNames = [...new Set(data.dailyByBot.map((r) => r.botName))];
  const dailyMap = new Map<string, Record<string, number>>();
  for (const row of data.dailyByBot) {
    if (!dailyMap.has(row.date)) dailyMap.set(row.date, { date: 0 });
    const entry = dailyMap.get(row.date) ?? {};
    entry[row.botName] = row.count;
  }
  const timelineData = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));

  return (
    <div className="space-y-4">
      {/* Bot breakdown + top pages */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("admin.analytics.botBreakdown")}>
          {data.bots.length === 0 ? (
            <NoData text={t("admin.analytics.noData")} />
          ) : (
            <BotList bots={data.bots} />
          )}
        </Panel>

        <Panel title={t("admin.analytics.topCrawledPages")}>
          <RankedTable
            rows={data.topPages.map((p) => ({
              label: p.title,
              value: p.views,
              muted: !p.isPost,
            }))}
            valueLabel={t("admin.analytics.tableViews")}
            nameLabel={t("admin.analytics.tablePage")}
            noData={t("admin.analytics.noData")}
          />
        </Panel>
      </div>

      {/* AI Bot Comparison Timeline */}
      {timelineData.length > 0 && botNames.length > 0 && (
        <Panel title={t("admin.analytics.aiBotComparison")}>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={timelineData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
              />
              <XAxis
                dataKey="date"
                tick={{
                  fontSize: 11,
                  fill: "var(--color-muted-foreground)",
                }}
                tickFormatter={formatDateShort}
              />
              <YAxis
                tick={{
                  fontSize: 11,
                  fill: "var(--color-muted-foreground)",
                }}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              {botNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  name={name}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      )}
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

function BotList({ bots }: { bots: { botName: string; count: number }[] }) {
  return (
    <div className="space-y-2 text-sm">
      {bots.map((bot, i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
              }}
            />
            <span className="truncate max-w-[160px]">{bot.botName}</span>
          </div>
          <span className="tabular-nums font-medium">
            {formatNumber(bot.count)}
          </span>
        </div>
      ))}
    </div>
  );
}

function RankedTable({
  rows,
  valueLabel,
  nameLabel,
  noData,
}: {
  rows: { label: string; value: number; muted?: boolean }[];
  valueLabel: string;
  nameLabel: string;
  noData: string;
}) {
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground py-4">{noData}</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th className="pb-2 font-medium">{nameLabel}</th>
          <th className="pb-2 font-medium text-right">{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-t border-border/50">
            <td
              className={`py-2 pr-4 truncate max-w-[200px] ${row.muted ? "text-muted-foreground" : ""}`}
            >
              {row.label}
            </td>
            <td className="py-2 text-right tabular-nums font-medium">
              {formatNumber(row.value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
