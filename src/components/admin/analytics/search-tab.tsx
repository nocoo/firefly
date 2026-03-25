"use client";

import type { SearchDetailResponse } from "@/models/analytics-types";
import {
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import {
  CHART_COLORS,
  chartAxis,
  formatDateLabel,
  formatNumber,
  CHART_MARGIN,
} from "./chart-helpers";
import { DashboardResponsiveContainer } from "./responsive-container";
import { useLocale } from "@/i18n/context";

interface SearchTabProps {
  data: SearchDetailResponse;
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function BotTimelineTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string; name: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-[var(--radius-widget)] border border-border bg-card p-2.5 shadow-sm">
      <p className="mb-1 text-xs font-medium text-foreground">
        {label ? formatDateLabel(label) : ""}
      </p>
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
// Component
// ---------------------------------------------------------------------------

export function SearchTab({ data }: SearchTabProps) {
  const { t } = useLocale();

  // Group dailyByBot into per-date rows for multi-line chart
  const botNames = [...new Set(data.dailyByBot.map((r) => r.botName))];
  const dailyMap = new Map<string, Record<string, number>>();
  for (const row of data.dailyByBot) {
    if (!dailyMap.has(row.date)) dailyMap.set(row.date, {});
    const entry = dailyMap.get(row.date) ?? {};
    entry[row.botName] = row.count;
  }
  const timelineData = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));

  return (
    <div className="space-y-4">
      {/* Bot breakdown */}
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
            rows={data.topPages.map((p) => {
              const row: { label: string; value: number; muted?: boolean; href?: string } = {
                label: p.title,
                value: p.views,
                muted: !p.isPost,
              };
              if (p.isPost) row.href = p.path;
              return row;
            })}
            valueLabel={t("admin.analytics.tableViews")}
            nameLabel={t("admin.analytics.tablePage")}
            noData={t("admin.analytics.noData")}
          />
        </Panel>
      </div>

      {/* Crawl Timeline */}
      {timelineData.length > 0 && botNames.length > 0 && (
        <Panel title={t("admin.analytics.crawlTimeline")}>
          {/* Inline legend */}
          <div className="mb-3 flex flex-wrap items-center gap-3">
            {botNames.map((name, i) => (
              <div key={name} className="flex items-center gap-1.5">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className="text-xs text-muted-foreground">{name}</span>
              </div>
            ))}
          </div>
          <div className="h-[250px]">
            <DashboardResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData} margin={CHART_MARGIN}>
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
                  width={40}
                />
                <Tooltip
                  content={<BotTimelineTooltip />}
                  isAnimationActive={false}
                />
                {botNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    name={name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </DashboardResponsiveContainer>
          </div>
        </Panel>
      )}

      {/* Crawler vs Page cross-table */}
      {data.crawlerVsPage.length > 0 && (
        <Panel title={t("admin.analytics.crawlerVsPage")}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">
                    {t("admin.analytics.tableBot")}
                  </th>
                  <th className="pb-2 font-medium">
                    {t("admin.analytics.tablePage")}
                  </th>
                  <th className="pb-2 font-medium text-right">
                    {t("admin.analytics.tableViews")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.crawlerVsPage.map((row, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      {row.botName}
                    </td>
                    <td className="py-1.5 pr-3 truncate max-w-[200px]">
                      {row.title}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-medium">
                      {formatNumber(row.count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  rows: { label: string; value: number; muted?: boolean; href?: string }[];
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
              {row.href ? (
                <a
                  href={row.href}
                  className="hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {row.label}
                </a>
              ) : (
                row.label
              )}
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
