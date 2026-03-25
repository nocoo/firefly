"use client";

import type { HumanDetailResponse } from "@/models/analytics-types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  CHART_COLORS,
  PIE_COLORS,
  TOOLTIP_STYLE,
  formatReferrer,
  formatNumber,
} from "./chart-helpers";
import { useLocale } from "@/i18n/context";

interface HumanTabProps {
  data: HumanDetailResponse;
}

export function HumanTab({ data }: HumanTabProps) {
  const { t } = useLocale();

  return (
    <div className="space-y-4">
      {/* Recent 24h banner */}
      <div className="rounded-[var(--radius-widget)] bg-secondary p-3 text-center">
        <span className="text-sm text-muted-foreground">
          {t("admin.analytics.recent24h")}:
        </span>{" "}
        <span className="text-lg font-semibold tabular-nums">
          {formatNumber(data.recent24h)}
        </span>
      </div>

      {/* Two-column: Top Pages + Referrers */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("admin.analytics.topPages")}>
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

        <Panel title={t("admin.analytics.topReferrers")}>
          <RankedTable
            rows={data.topReferrers.map((r) => ({
              label: formatReferrer(r.referrer),
              value: r.views,
            }))}
            valueLabel={t("admin.analytics.tableViews")}
            nameLabel={t("admin.analytics.tableReferrer")}
            noData={t("admin.analytics.noData")}
          />
        </Panel>
      </div>

      {/* Three-column: Devices, Browsers, OS */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t("admin.analytics.devices")}>
          {data.devices.length === 0 ? (
            <NoData text={t("admin.analytics.noData")} />
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
                    <Cell
                      key={i}
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title={t("admin.analytics.browsers")}>
          {data.browsers.length === 0 ? (
            <NoData text={t("admin.analytics.noData")} />
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

        <Panel title={t("admin.analytics.os")}>
          {data.os.length === 0 ? (
            <NoData text={t("admin.analytics.noData")} />
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
      </div>

      {/* Countries */}
      <Panel title={t("admin.analytics.countries")}>
        {data.countries.length === 0 ? (
          <NoData text={t("admin.analytics.noData")} />
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
    <div className="rounded-[var(--radius-widget)] border border-border/50 bg-secondary/50 p-4">
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
