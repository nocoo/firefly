"use client";

import type { HumanDetailResponse } from "@/models/analytics-types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import {
  CHART_COLORS,
  PIE_COLORS,
  chartAxis,
  formatReferrer,
  formatNumber,
  H_BAR_MARGIN,
} from "./chart-helpers";
import { DashboardResponsiveContainer } from "./responsive-container";

interface HumanTabProps {
  data: HumanDetailResponse;
}

// ---------------------------------------------------------------------------
// Custom tooltips
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
    <div className="rounded-widget border border-border bg-popover p-2.5 shadow-sm">
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
    <div className="rounded-widget border border-border bg-popover p-2.5 shadow-sm">
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

export function HumanTab({ data }: HumanTabProps) {
  // Pre-compute donut data with fill + percent
  const deviceTotal = data.devices.reduce((s, d) => s + d.count, 0);
  const donutData = data.devices.map((d, i) => ({
    name: d.deviceType,
    value: d.count,
    fill: PIE_COLORS[i % PIE_COLORS.length],
    percent: deviceTotal > 0 ? d.count / deviceTotal : 0,
  }));

  return (
    <div className="space-y-4">
      {/* Recent 24h banner */}
      <div className="rounded-widget bg-secondary p-3 text-center">
        <span className="text-sm text-muted-foreground">
          近 24 小时:
        </span>{" "}
        <span className="text-lg font-semibold font-display tabular-nums">
          {formatNumber(data.recent24h)}
        </span>
      </div>

      {/* Two-column: Top Pages + Referrers */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="热门页面">
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
            valueLabel="浏览量"
            nameLabel="页面"
            noData="暂无数据"
          />
        </Panel>

        <Panel title="热门来源">
          <RankedTable
            rows={data.topReferrers
              .filter((r) => r.referrer.trim() !== "")
              .map((r) => ({
                label: formatReferrer(r.referrer),
                value: r.views,
              }))}
            valueLabel="浏览量"
            nameLabel="来源"
            noData="暂无数据"
          />
        </Panel>
      </div>

      {/* 2x2 grid: Devices, Browsers, OS, Countries */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="设备">
          {donutData.length === 0 ? (
            <NoData text="暂无数据" />
          ) : (
            <div className="flex flex-col items-center">
              <div className="h-[160px] w-full max-w-[200px]">
                <DashboardResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="50%"
                      outerRadius="80%"
                      strokeWidth={0}
                      paddingAngle={2}
                    >
                      {donutData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<DonutTooltip />}
                      isAnimationActive={false}
                    />
                  </PieChart>
                </DashboardResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="mt-2 grid w-full grid-cols-2 gap-x-4 gap-y-1.5">
                {donutData.map((item) => (
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
          )}
        </Panel>

        <Panel title="浏览器">
          {data.browsers.length === 0 ? (
            <NoData text="暂无数据" />
          ) : (
            <HorizontalBarList
              data={data.browsers.map((b) => ({
                name: b.browser,
                value: b.count,
              }))}
              color={CHART_COLORS[1]}
            />
          )}
        </Panel>

        <Panel title="操作系统">
          {data.os.length === 0 ? (
            <NoData text="暂无数据" />
          ) : (
            <HorizontalBarList
              data={data.os.map((o) => ({
                name: o.os,
                value: o.count,
              }))}
              color={CHART_COLORS[2]}
            />
          )}
        </Panel>

        <Panel title="国家">
          {data.countries.length === 0 ? (
            <NoData text="暂无数据" />
          ) : (
            <HorizontalBarList
              data={data.countries.map((c) => ({
                name: c.country,
                value: c.count,
              }))}
              color={CHART_COLORS[0]}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-widget bg-secondary p-4">
      <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function NoData({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-4">{text}</p>;
}

function RankedTable({
  rows,
  valueLabel,
  nameLabel,
  noData,
}: {
  rows: {
    label: string;
    value: number;
    muted?: boolean;
    href?: string;
  }[];
  valueLabel: string;
  nameLabel: string;
  noData: string;
}) {
  if (rows.length === 0) return <NoData text={noData} />;
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
              className={`py-2 pr-4 truncate max-w-[200px] ${
                row.muted ? "text-muted-foreground" : ""
              }`}
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

function HorizontalBarList({
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
