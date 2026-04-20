"use client";

import type { OtherBotDetailResponse } from "@/models/analytics-types";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { PIE_COLORS, formatNumber } from "./chart-helpers";
import { DashboardResponsiveContainer } from "./responsive-container";

interface OtherBotTabProps {
  data: OtherBotDetailResponse;
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { fill: string; percent: number };
  }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0] as (typeof payload)[number];

  return (
    <div className="rounded-[var(--radius-widget)] border border-border bg-popover p-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: item.payload.fill }}
        />
        <span className="text-sm font-medium text-foreground">{item.name}</span>
      </div>
      <div className="text-sm text-muted-foreground">
        {formatNumber(item.value)} ({(item.payload.percent * 100).toFixed(1)}%)
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut chart with legend
// ---------------------------------------------------------------------------

function DonutWithLegend({
  data,
}: {
  data: { name: string; value: number; fill: string; percent: number }[];
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="h-[160px] w-full max-w-[200px]">
        <DashboardResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="50%"
              outerRadius="80%"
              strokeWidth={0}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} isAnimationActive={false} />
          </PieChart>
        </DashboardResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="mt-2 grid w-full grid-cols-2 gap-x-4 gap-y-1.5">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: item.fill }}
            />
            <span className="text-xs text-muted-foreground truncate">
              {item.name}
            </span>
            <span className="ml-auto text-xs font-medium text-foreground">
              {formatNumber(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OtherBotTab({ data }: OtherBotTabProps) {
  // Pre-compute donut data for category breakdown
  const categoryTotal = data.byCategory.reduce((s, c) => s + c.count, 0);
  const categoryDonut = data.byCategory.map((c, i) => ({
    name: c.category,
    value: c.count,
    fill: PIE_COLORS[i % PIE_COLORS.length],
    percent: categoryTotal > 0 ? c.count / categoryTotal : 0,
  }));

  // Pre-compute donut data for social bots
  const socialTotal = data.socialBots.reduce((s, b) => s + b.count, 0);
  const socialDonut = data.socialBots.map((b, i) => ({
    name: b.botName,
    value: b.count,
    fill: PIE_COLORS[i % PIE_COLORS.length],
    percent: socialTotal > 0 ? b.count / socialTotal : 0,
  }));

  // Pre-compute donut data for monitor bots
  const monitorTotal = data.monitorBots.reduce((s, b) => s + b.count, 0);
  const monitorDonut = data.monitorBots.map((b, i) => ({
    name: b.botName,
    value: b.count,
    fill: PIE_COLORS[i % PIE_COLORS.length],
    percent: monitorTotal > 0 ? b.count / monitorTotal : 0,
  }));

  return (
    <div className="space-y-4">
      {/* Category breakdown */}
      <Panel title="分类统计">
        {categoryDonut.length === 0 ? (
          <NoData text="暂无数据" />
        ) : (
          <DonutWithLegend data={categoryDonut} />
        )}
      </Panel>

      {/* Two-column: Social + Monitor */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="社交爬虫">
          {socialDonut.length === 0 ? (
            <NoData text="暂无数据" />
          ) : (
            <DonutWithLegend data={socialDonut} />
          )}
        </Panel>

        <Panel title="监控爬虫">
          {monitorDonut.length === 0 ? (
            <NoData text="暂无数据" />
          ) : (
            <DonutWithLegend data={monitorDonut} />
          )}
        </Panel>
      </div>

      {/* Unknown bots with user agent */}
      {data.unknownBots.length > 0 && (
        <Panel title="未知爬虫">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">
                    爬虫
                  </th>
                  <th className="pb-2 font-medium">
                    User Agent
                  </th>
                  <th className="pb-2 font-medium text-right">
                    浏览量
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.unknownBots.map((bot, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="py-1.5 pr-3">{bot.botName}</td>
                    <td className="py-1.5 pr-3 truncate max-w-[300px] text-muted-foreground text-xs font-mono">
                      {bot.userAgent}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-medium">
                      {formatNumber(bot.count)}
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
    <div className="rounded-[var(--radius-widget)] bg-secondary p-4">
      <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function NoData({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-4">{text}</p>;
}
